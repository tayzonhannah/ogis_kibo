# Phase 4 verification against the live Supabase project.
#
#   pwsh kibo-app/scripts/verify-phase4.ps1
#
# Phase 4 is almost entirely server-side semantics - who may open the shared
# away interval, what it is finally worth, and what a client is allowed to write
# - so it is verified here rather than in a browser. The browser wiring
# (visibilitychange -> hidden_since -> the meter) is covered by the Phase 4
# section of scripts/e2e-handoff.mjs.
#
# Reads .env.local, so it follows whatever project that file points at. Creates
# ~3 throwaway anonymous users and 2 rooms per run.
#
# The 8-hour cap check needs SUPABASE_SERVICE_ROLE_KEY to backdate co_away_since
# (no client may write that column - which is the point). Without the key that
# one section is skipped and says so.
#
# NOT covered here: the simultaneous-hide race that motivated locking the room
# before counting in sync_co_away(). Every request below is sequential, so it
# cannot reproduce two participants hiding inside the same instant.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '..\.env.local'
if (-not (Test-Path $envFile)) { throw "Missing $envFile - copy .env.local.example and fill it in." }
$envLines = Get-Content $envFile
function EnvVal($name, $required = $true) {
  # Tolerate what dotenv tolerates: leading whitespace, an `export` prefix, and a
  # quoted value. An anchored "^NAME=" match misses a line indented by a single
  # space and then reports the key as absent, which is a genuinely confusing way
  # to fail - the value is right there in the file.
  $pattern = "^\s*(?:export\s+)?$([regex]::Escape($name))\s*="
  $line = ($envLines | Where-Object { $_ -match $pattern } | Select-Object -First 1)
  if (-not $line) {
    if ($required) { throw "Missing $name in .env.local" }
    return $null
  }
  $value = ($line -replace $pattern, '').Trim()
  if ($value.Length -ge 2 -and (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'")))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  return $value
}
$base = (EnvVal 'NEXT_PUBLIC_SUPABASE_URL').TrimEnd('/')
$anon = EnvVal 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
$service = EnvVal 'SUPABASE_SERVICE_ROLE_KEY' $false
if ($service -eq 'your_service_role_key') { $service = $null }
$ErrorActionPreference = 'Continue'

$script:pass = 0
$script:fail = 0

# Identify as a CLI, not a browser.
#
# Supabase refuses a secret API key on any request that looks browser-borne, and
# Invoke-WebRequest's default User-Agent contains "Mozilla" - so the whole
# service-role section fails with 401 "Forbidden use of secret API key in
# browser" while the key is perfectly valid. The refusal is the gateway doing its
# job; the honest fix is to stop claiming to be Mozilla.
$UA = 'kibo-verify/1.0'

# Write-Host, not bare strings: inside a function a bare string joins the return
# value and silently corrupts tokens. Same trap as verify-phase1.ps1.
function Req($method, $url, $body, $token, $key) {
  if (-not $key) { $key = $anon }
  $h = @{ apikey = $key; 'Content-Type' = 'application/json' }
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try {
    $p = @{ Uri = $url; Method = $method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 30; UserAgent = $UA }
    if ($null -ne $body) { $p.Body = $body }
    $r = Invoke-WebRequest @p
    return @{ code = [int]$r.StatusCode; body = [string]$r.Content }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    $txt = ''
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $txt = $_.ErrorDetails.Message }
    if (-not $txt) {
      try {
        $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        $txt = $sr.ReadToEnd()
      } catch {}
    }
    return @{ code = $code; body = [string]$txt }
  }
}

# Service role bypasses RLS entirely. Used only to backdate co_away_since.
#
# The key goes in `apikey` ONLY, with no Authorization header. A new-format
# secret (sb_secret_...) is not a JWT, so presenting it as a bearer earns
# PGRST301 "Expected 3 parts in JWT"; the gateway resolves the role from `apikey`
# for both the new and legacy formats, so apikey-only is the portable shape.
function AdminReq($method, $url, $body) {
  if (-not $service) { return @{ code = 0; body = 'no service key' } }
  return Req $method $url $body $null $service
}

function JArr($body) {
  if ([string]::IsNullOrWhiteSpace($body)) { return @() }
  try { return @($body | ConvertFrom-Json) } catch { return @() }
}

function Check($name, $condition, $detail) {
  if ($condition) { Write-Host "  [PASS] $name"; $script:pass++ }
  else { Write-Host "  [FAIL] $name"; Write-Host "         got: $detail"; $script:fail++ }
}
function Skip($name, $why) { Write-Host "  [SKIP] $name - $why" }

function NewUser($label) {
  $r = Req 'POST' "$base/auth/v1/signup" '{}' $null $null
  if ($r.code -ne 200) {
    Write-Host "  [FAIL] $label anonymous sign-in ($($r.code)): $($r.body)"
    $script:fail++
    return $null
  }
  $j = $r.body | ConvertFrom-Json
  Write-Host "         $label = $($j.user.id.Substring(0,8)).."
  return @{ token = [string]$j.access_token; id = [string]$j.user.id }
}

function Rpc($fn, $body, $token) { return Req 'POST' "$base/rest/v1/rpc/$fn" $body $token $null }

# --- the two operations under test -------------------------------------------

# What useCoAway does on visibilitychange, and nothing more.
function Look($user, $away, $at) {
  if ($away) {
    if (-not $at) { $at = (Get-Date).ToUniversalTime().ToString('o') }
    $body = @{ hidden_since = $at } | ConvertTo-Json -Compress
  } else {
    $body = '{"hidden_since":null}'
  }
  return Req 'PATCH' `
    "$base/rest/v1/room_participants?room_id=eq.$roomId&user_id=eq.$($user.id)" `
    $body $user.token $null
}

# The ledger as a client sees it.
function Ledger($token) {
  $rows = JArr (Req 'GET' "$base/rest/v1/rooms?select=nutrient_seconds,co_away_since&id=eq.$roomId" $null $token $null).body
  if ($rows.Count -lt 1) { return $null }
  return $rows[0]
}

# -----------------------------------------------------------------------------

Write-Host '=== 0. Which migration is actually live?'
$ver = Req 'POST' "$base/rest/v1/rpc/kibo_schema_version" '{}' $null $null
$live = if ($ver.code -eq 200) { ($ver.body | ConvertFrom-Json) } else { "unavailable ($($ver.code))" }
Write-Host "         deployed schema version: $live"
if ($live -ne '0005') {
  Write-Host '  [STOP] Expected 0005. Run supabase/migrations/0005_phase4_co_away.sql.'
  exit 2
}
Write-Host '  [PASS] migration 0005 is live'
$script:pass++
if (-not $service) { Write-Host '         (no SUPABASE_SERVICE_ROLE_KEY - the cap section will be skipped)' }

Write-Host "`n=== 0b. A two-person tank"
$A = NewUser 'A'
$B = NewUser 'B'
if (-not $A -or -not $B) { Write-Host "`nAborting."; exit 1 }

$r = Rpc 'create_room' '{}' $A.token
$code = if ($r.code -eq 200) { ($r.body | ConvertFrom-Json) } else { $null }
$rooms = JArr (Req 'GET' "$base/rest/v1/rooms?select=id" $null $A.token $null).body
$roomId = if ($rooms.Count -ge 1) { $rooms[0].id } else { $null }
Check 'room created' ($roomId -and $code) "code=$code id=$roomId"
if (-not $roomId) { Write-Host "`nAborting."; exit 1 }

$r = Rpc 'join_room' (@{ room_code = $code } | ConvertTo-Json -Compress) $B.token
$joined = (JArr $r.body)
Check 'both participants in the tank' ($joined.Count -ge 1 -and $joined[0].status -eq 'ok') "$($r.code) $($r.body)"

$L = Ledger $A.token
Check 'a fresh tank has banked nothing' ($L.nutrient_seconds -eq 0) "$($L.nutrient_seconds)"
Check 'a fresh tank has no interval open' ($null -eq $L.co_away_since) "$($L.co_away_since)"
$script:highWater = 0

Write-Host "`n=== 1. Both looking: nothing accrues"
Start-Sleep -Seconds 2
$L = Ledger $A.token
Check 'two present participants accrue nothing over 2s' ($L.nutrient_seconds -eq 0) "$($L.nutrient_seconds)"

Write-Host "`n=== 2. One away is not enough"
$r = Look $A $true $null
Check 'a participant may write their own hidden_since' ($r.code -lt 300) "$($r.code) $($r.body)"
Start-Sleep -Seconds 2
$L = Ledger $A.token
Check 'one participant away does not open the interval' ($null -eq $L.co_away_since) "$($L.co_away_since)"
Check 'one participant away accrues nothing' ($L.nutrient_seconds -eq 0) "$($L.nutrient_seconds)"

$null = Look $A $false $null
$L = Ledger $A.token
Check 'returning from a solo absence banks nothing' ($L.nutrient_seconds -eq 0) "$($L.nutrient_seconds)"

Write-Host "`n=== 3. Both away opens an interval, and banks nothing yet"
$null = Look $A $true $null
$null = Look $B $true $null
$bothAwayAt = Get-Date
$L = Ledger $A.token
Check 'the interval opens once everyone has looked away' ($null -ne $L.co_away_since) 'co_away_since still null'
Check 'nothing is banked while the interval is open' ($L.nutrient_seconds -eq 0) "$($L.nutrient_seconds)"

$opened = $L.co_away_since
Start-Sleep -Seconds 2
$L = Ledger $A.token
Check 'the open interval is not re-opened by the passage of time' ($L.co_away_since -eq $opened) "$($L.co_away_since) vs $opened"

Write-Host "`n=== 3b. A repeated hidden_since write is a no-op"
# useCoAway's unload beacon can land behind its own ordinary write. The trigger
# leaves early when the value has not moved, so this must not disturb anything.
$again = Look $A $true $opened
Check 'writing the same hidden_since again succeeds' ($again.code -lt 300) "$($again.code) $($again.body)"
$L = Ledger $A.token
Check 'a repeated write does not restart the interval' ($L.co_away_since -eq $opened) "$($L.co_away_since) vs $opened"
Check 'a repeated write banks nothing' ($L.nutrient_seconds -eq 0) "$($L.nutrient_seconds)"

Write-Host "`n=== 4. Returning banks the interval, once"
Start-Sleep -Seconds 3
$null = Look $A $false $null
$elapsed = [int][Math]::Round(((Get-Date) - $bothAwayAt).TotalSeconds)
$L = Ledger $A.token
Write-Host "         wall clock away: ${elapsed}s   banked: $($L.nutrient_seconds)s"
Check 'the interval closes when someone comes back' ($null -eq $L.co_away_since) "$($L.co_away_since)"
Check 'banked seconds match wall clock within 2s' ([Math]::Abs($L.nutrient_seconds - $elapsed) -le 2) "banked=$($L.nutrient_seconds) elapsed=$elapsed"
Check 'banked seconds are positive' ($L.nutrient_seconds -gt 0) "$($L.nutrient_seconds)"
$afterFirst = [int]$L.nutrient_seconds
$script:highWater = $afterFirst

# B never came back, but one returning participant is enough to close it.
$null = Look $A $false $null
$L = Ledger $A.token
Check 'returning twice does not bank twice' ($L.nutrient_seconds -eq $afterFirst) "$($L.nutrient_seconds) vs $afterFirst"

Write-Host "`n=== 5. Rapid switching neither double-counts nor goes negative"
# B is still away, so every one of A's hides opens a real interval and every
# return banks it. The credit is legitimate but must stay within the few
# hundred milliseconds each toggle actually took.
$beforeBurst = [int](Ledger $A.token).nutrient_seconds
$burstStart = Get-Date
for ($i = 1; $i -le 6; $i++) {
  $null = Look $A $true $null
  $null = Look $A $false $null
}
$burstSeconds = [int][Math]::Ceiling(((Get-Date) - $burstStart).TotalSeconds)
$L = Ledger $A.token
$delta = [int]$L.nutrient_seconds - $beforeBurst
Write-Host "         6 hide/return cycles took ${burstSeconds}s and banked ${delta}s"
Check 'a switching burst banks no more than it lasted' ($delta -le $burstSeconds) "delta=$delta burst=$burstSeconds"
Check 'a switching burst never banks a negative' ($delta -ge 0) "delta=$delta"
Check 'the ledger never went backwards' ([int]$L.nutrient_seconds -ge $script:highWater) "$($L.nutrient_seconds) vs $script:highWater"
Check 'no interval is left open after returning' ($null -eq $L.co_away_since) "$($L.co_away_since)"
$script:highWater = [int]$L.nutrient_seconds

Write-Host "`n=== 6. One interval is capped at MAX_AWAY_CREDIT_SECONDS (28800)"
if (-not $service) {
  Skip 'a long absence credits exactly the cap' 'needs SUPABASE_SERVICE_ROLE_KEY to backdate co_away_since'
} else {
  $null = Look $A $true $null
  $L = Ledger $A.token
  Check 'interval re-opened for the cap test' ($null -ne $L.co_away_since) 'not open'
  $before = [int]$L.nutrient_seconds

  # 10 hours ago: past the cap, so the credit must clamp rather than track it.
  $tenHoursAgo = (Get-Date).ToUniversalTime().AddHours(-10).ToString('o')
  $r = AdminReq 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" (@{ co_away_since = $tenHoursAgo } | ConvertTo-Json -Compress)
  Check 'service role backdated co_away_since by 10 hours' ($r.code -lt 300) "$($r.code) $($r.body)"

  $null = Look $A $false $null
  $L = Ledger $A.token
  $credited = [int]$L.nutrient_seconds - $before
  Write-Host "         10h absence credited: ${credited}s"
  Check 'a 10-hour absence credits exactly 28800s' ($credited -eq 28800) "$credited"
  Check 'the capped interval still closed' ($null -eq $L.co_away_since) "$($L.co_away_since)"
  $script:highWater = [int]$L.nutrient_seconds
}

Write-Host "`n=== 7. A solo tank never accrues"
$C = NewUser 'C'
$r = Rpc 'create_room' '{}' $C.token
$soloCode = if ($r.code -eq 200) { ($r.body | ConvertFrom-Json) } else { $null }
$soloRooms = JArr (Req 'GET' "$base/rest/v1/rooms?select=id" $null $C.token $null).body
$soloId = if ($soloRooms.Count -ge 1) { $soloRooms[0].id } else { $null }
Check 'solo tank created' ($soloId -ne $null) "code=$soloCode"

$r = Req 'PATCH' "$base/rest/v1/room_participants?room_id=eq.$soloId&user_id=eq.$($C.id)" `
  (@{ hidden_since = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress) $C.token $null
Check 'the lone participant may report themselves away' ($r.code -lt 300) "$($r.code) $($r.body)"
Start-Sleep -Seconds 3
$soloRow = (JArr (Req 'GET' "$base/rest/v1/rooms?select=nutrient_seconds,co_away_since&id=eq.$soloId" $null $C.token $null).body)[0]
Check 'a solo absence opens no interval (total >= 2)' ($null -eq $soloRow.co_away_since) "$($soloRow.co_away_since)"

$r = Req 'PATCH' "$base/rest/v1/room_participants?room_id=eq.$soloId&user_id=eq.$($C.id)" `
  '{"hidden_since":null}' $C.token $null
$soloRow = (JArr (Req 'GET' "$base/rest/v1/rooms?select=nutrient_seconds,co_away_since&id=eq.$soloId" $null $C.token $null).body)[0]
Check 'one person cannot farm nutrients alone' ($soloRow.nutrient_seconds -eq 0) "$($soloRow.nutrient_seconds)"

Write-Host "`n=== 8. The ledger is not client-writable"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"nutrient_seconds":999999}' $A.token $null
Check 'nutrient_seconds write denied on column privilege' ($r.code -eq 403 -and $r.body -match 'permission denied|42501') "$($r.code) $($r.body)"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"co_away_since":"2020-01-01T00:00:00Z"}' $A.token $null
Check 'co_away_since write denied on column privilege' ($r.code -eq 403 -and $r.body -match 'permission denied|42501') "$($r.code) $($r.body)"

# The interesting forgery for Phase 4: mark the OTHER person away, so the
# interval opens while you are still looking. The "self update participant"
# policy is what stops it, so this returns 200 with an empty result set rather
# than an error - nothing matched.
$bHiddenBefore = (JArr (Req 'GET' "$base/rest/v1/room_participants?select=user_id,hidden_since&user_id=eq.$($B.id)" $null $A.token $null).body)[0].hidden_since
$r = Req 'PATCH' "$base/rest/v1/room_participants?room_id=eq.$roomId&user_id=eq.$($B.id)" `
  '{"hidden_since":null}' $A.token $null
$bHiddenAfter = (JArr (Req 'GET' "$base/rest/v1/room_participants?select=user_id,hidden_since&user_id=eq.$($B.id)" $null $A.token $null).body)[0].hidden_since
Check "a participant cannot rewrite the other person's away state" ($bHiddenBefore -eq $bHiddenAfter) "before=$bHiddenBefore after=$bHiddenAfter"

# The trigger fires on any UPDATE naming hidden_since, so a caller bundling it
# with the heartbeat column must still be accepted and still be a no-op.
$bundled = @{ last_seen_at = (Get-Date).ToUniversalTime().ToString('o'); hidden_since = $null } | ConvertTo-Json -Compress
$r = Req 'PATCH' "$base/rest/v1/room_participants?room_id=eq.$roomId&user_id=eq.$($A.id)" $bundled $A.token $null
Check 'a bundled last_seen_at + hidden_since write is accepted' ($r.code -lt 300) "$($r.code) $($r.body)"
$L = Ledger $A.token
Check 'the bundled no-op write left the ledger alone' ([int]$L.nutrient_seconds -eq $script:highWater) "$($L.nutrient_seconds) vs $script:highWater"

Write-Host "`n======================================"
Write-Host "PASS: $script:pass   FAIL: $script:fail"
if ($script:fail -gt 0) { Write-Host 'RESULT: problems found' } else { Write-Host 'RESULT: all Phase 4 checks green' }
if ($script:fail -gt 0) { exit 1 }
