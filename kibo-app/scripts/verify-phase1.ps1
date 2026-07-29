# Phase 1 verification against the live Supabase project.
# Exercises the room RPCs, RLS, column privileges, and the join rate limiter
# the way a browser client would - no browser required.
#
#   pwsh kibo-app/scripts/verify-phase1.ps1
#
# Reads both values from kibo-app/.env.local, so it follows whatever project
# that file points at. Creates ~5 throwaway anonymous users and 2 rooms per run;
# clear them under Authentication -> Users if you care about tidiness.
#
# Two PowerShell traps this script exists on the far side of:
#  - progress lines use Write-Host deliberately. A bare string inside a function
#    joins that function's return value, which silently corrupts tokens.
#  - error-response bodies come from $_.ErrorDetails.Message; PowerShell 5.1
#    has already drained the response stream by the time you reach it.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '..\.env.local'
if (-not (Test-Path $envFile)) { throw "Missing $envFile - copy .env.local.example and fill it in." }
$envLines = Get-Content $envFile
function EnvVal($name) {
  $line = ($envLines | Select-String "^$name=").Line
  if (-not $line) { throw "Missing $name in .env.local" }
  return ($line -replace "^$name=", '').Trim()
}
$base = (EnvVal 'NEXT_PUBLIC_SUPABASE_URL').TrimEnd('/')
$anon = EnvVal 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
$ErrorActionPreference = 'Continue'

$script:pass = 0
$script:fail = 0

function Req($method, $url, $body, $token) {
  $h = @{ apikey = $anon; 'Content-Type' = 'application/json' }
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try {
    $p = @{ Uri = $url; Method = $method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 30 }
    if ($null -ne $body) { $p.Body = $body }
    $r = Invoke-WebRequest @p
    return @{ code = [int]$r.StatusCode; body = [string]$r.Content }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    # PowerShell 5.1 drains the error-response stream into ErrorDetails, so the
    # stream is usually already empty. Prefer ErrorDetails, fall back to it.
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

# Empty body must yield an empty array, not a phantom single element.
function JArr($body) {
  if ([string]::IsNullOrWhiteSpace($body)) { return @() }
  try { return @($body | ConvertFrom-Json) } catch { return @() }
}

function Check($name, $condition, $detail) {
  if ($condition) { Write-Host "  [PASS] $name"; $script:pass++ }
  else { Write-Host "  [FAIL] $name"; Write-Host "         got: $detail"; $script:fail++ }
}

function NewUser($label) {
  $r = Req 'POST' "$base/auth/v1/signup" '{}' $null
  if ($r.code -ne 200) {
    Write-Host "  [FAIL] $label anonymous sign-in ($($r.code)): $($r.body)"
    $script:fail++
    return $null
  }
  $j = $r.body | ConvertFrom-Json
  Write-Host "         $label = $($j.user.id.Substring(0,8))..  token len $($j.access_token.Length)"
  return [string]$j.access_token
}

function Rpc($fn, $body, $token) { return Req 'POST' "$base/rest/v1/rpc/$fn" $body $token }

# join_room returns a status row, so failures are 200s with a status field.
function JoinStatus($resp) {
  $rows = JArr $resp.body
  if ($rows.Count -ge 1 -and $rows[0].status) { return [string]$rows[0].status }
  return "http$($resp.code):$($resp.body)"
}
function JoinRoomId($resp) {
  $rows = JArr $resp.body
  if ($rows.Count -ge 1) { return $rows[0].joined_room }
  return $null
}

Write-Host "=== 0. Which migration is actually live?"
$ver = (Req 'POST' "$base/rest/v1/rpc/kibo_schema_version" '{}' $null)
$live = if ($ver.code -eq 200) { ($ver.body | ConvertFrom-Json) } else { "unavailable ($($ver.code))" }
Write-Host "         deployed schema version: $live"
if ($live -ne '0002c') {
  Write-Host "  [STOP] Expected 0002c. The migration file has not been applied."
  Write-Host "         Re-run kibo-app/supabase/migrations/0002_join_room_returns_status.sql"
  exit 2
}
Write-Host "  [PASS] migration 0002c is live"
$script:pass++

Write-Host "`n=== 0b. Sanity: token actually authenticates"
$A = NewUser 'A'
Check 'anonymous sign-in returns a usable token' ($A -is [string] -and $A.Length -gt 40) "type=$($A.GetType().Name)"
if (-not ($A -is [string])) { Write-Host "`nAborting."; exit 1 }
$r = Req 'GET' "$base/rest/v1/rooms?select=id" $null $A
Check 'authenticated GET is not 401' ($r.code -eq 200) "$($r.code) $($r.body)"

Write-Host "`n=== 1. create_room"
$r = Rpc 'create_room' '{}' $A
$code = $null
if ($r.code -eq 200) { $code = ($r.body | ConvertFrom-Json) }
Check 'create_room returns an 8-char code' ($code -is [string] -and $code.Length -eq 8) "$($r.code) $($r.body)"
Check 'code avoids ambiguous glyphs I/O/0/1' ($code -and $code -notmatch '[IO01]') "$code"
Write-Host "         code = $code"

Write-Host "`n=== 2. Creator sees their room and its seeded fish"
$rooms = JArr (Req 'GET' "$base/rest/v1/rooms?select=id,code,tank_mood" $null $A).body
Check 'creator sees exactly 1 room' ($rooms.Count -eq 1) "$($rooms.Count)"
$roomId = if ($rooms.Count -ge 1) { $rooms[0].id } else { $null }
$fish = JArr (Req 'GET' "$base/rest/v1/fish?select=id,holder,y_frac,speed_px_s" $null $A).body
Check 'room seeded with 2 fish' ($fish.Count -eq 2) "$($fish.Count)"
Check 'both fish held by the creator' (($fish | Where-Object { $_.holder }).Count -eq 2) "$(($fish | Where-Object { $_.holder }).Count) held"

Write-Host "`n=== 3. RLS isolation: a stranger sees nothing"
$B = NewUser 'B'
Check 'non-member sees 0 rooms' ((JArr (Req 'GET' "$base/rest/v1/rooms?select=id" $null $B).body).Count -eq 0) 'saw rooms'
Check 'non-member sees 0 fish' ((JArr (Req 'GET' "$base/rest/v1/fish?select=id" $null $B).body).Count -eq 0) 'saw fish'
Check 'non-member cannot resolve a room by code' ((JArr (Req 'GET' "$base/rest/v1/rooms?select=id&code=eq.$code" $null $B).body).Count -eq 0) 'resolved code'

Write-Host "`n=== 4. join_room"
$r = Rpc 'join_room' (@{ room_code = $code } | ConvertTo-Json -Compress) $B
Check 'second participant joins (status ok)' ((JoinStatus $r) -eq 'ok') (JoinStatus $r)
Check 'join returns the room id' ((JoinRoomId $r) -eq $roomId) "$(JoinRoomId $r) vs $roomId"
Check 'room now has 2 participants' ((JArr (Req 'GET' "$base/rest/v1/room_participants?select=user_id" $null $B).body).Count -eq 2) 'wrong count'
Check 'joiner can now see the room' ((JArr (Req 'GET' "$base/rest/v1/rooms?select=id" $null $B).body).Count -eq 1) 'cannot see room'
Check 'lowercase code is accepted (upper/trim in join_room)' ((JoinStatus (Rpc 'join_room' (@{ room_code = "  $($code.ToLower())  " } | ConvertTo-Json -Compress) $B)) -eq 'ok') 'rejected lowercase/padded'

Write-Host "`n=== 5. Capacity cap (ROOM_CAPACITY = 2)"
$C = NewUser 'C'
$r = Rpc 'join_room' (@{ room_code = $code } | ConvertTo-Json -Compress) $C
Check 'third participant rejected with room_full' ((JoinStatus $r) -eq 'room_full') (JoinStatus $r)
Check 'rejected joiner still sees 0 rooms' ((JArr (Req 'GET' "$base/rest/v1/rooms?select=id" $null $C).body).Count -eq 0) 'leaked room'

Write-Host "`n=== 6. Idempotent rejoin"
$r = Rpc 'join_room' (@{ room_code = $code } | ConvertTo-Json -Compress) $B
Check 'member rejoining still succeeds' ((JoinStatus $r) -eq 'ok') (JoinStatus $r)
Check 'rejoin added no duplicate row' ((JArr (Req 'GET' "$base/rest/v1/room_participants?select=user_id" $null $B).body).Count -eq 2) 'duplicated'

Write-Host "`n=== 7. Unknown code"
$r = Rpc 'join_room' '{"room_code":"ZZZZZZZZ"}' $A
Check 'unknown code returns room_not_found' ((JoinStatus $r) -eq 'room_not_found') (JoinStatus $r)

Write-Host "`n=== 8. Column privileges: score/code forgery blocked, mood allowed"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"nutrient_seconds":999999}' $A
Check 'nutrient_seconds write denied on column privilege' ($r.code -eq 403 -and $r.body -match 'permission denied|42501') "$($r.code) $($r.body)"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"code":"HACKED11"}' $A
Check 'room code rewrite denied on column privilege' ($r.code -eq 403 -and $r.body -match 'permission denied|42501') "$($r.code) $($r.body)"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"co_away_since":"2020-01-01T00:00:00Z"}' $A
Check 'co_away_since write denied on column privilege' ($r.code -eq 403 -and $r.body -match 'permission denied|42501') "$($r.code) $($r.body)"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"tank_mood":"deep"}' $A
Check 'tank_mood IS writable (grants scoped, not blanket-denied)' ($r.code -lt 300) "$($r.code) $($r.body)"
$r = Req 'PATCH' "$base/rest/v1/rooms?id=eq.$roomId" '{"tank_mood":"neon"}' $A
Check 'invalid mood rejected by check constraint (23514)' ($r.body -match '23514|violates check constraint') "$($r.code) $($r.body)"

Write-Host "`n=== 9. Fish theft blocked by the policy WITH CHECK"
$fishId = if ($fish.Count -ge 1) { $fish[0].id } else { $null }
$r = Req 'PATCH' "$base/rest/v1/fish?id=eq.$fishId" '{"holder":"00000000-0000-0000-0000-000000000000"}' $A
Check 'cannot assign a fish to a non-member' ($r.code -eq 403 -and $r.body -match 'row-level security|42501') "$($r.code) $($r.body)"
$r = Req 'PATCH' "$base/rest/v1/fish?id=eq.$fishId" '{"y_frac":5}' $A
Check 'out-of-range y_frac rejected by check constraint' ($r.body -match '23514|violates check constraint') "$($r.code) $($r.body)"
$bFishId = (JArr (Req 'GET' "$base/rest/v1/fish?select=id" $null $C).body)
Check 'non-member still sees no fish after all this' ($bFishId.Count -eq 0) "$($bFishId.Count)"

Write-Host "`n=== 10. Handoff write path (what Aquarium.tsx does)"
$bUserId = ((Req 'GET' "$base/auth/v1/user" $null $B).body | ConvertFrom-Json).id
$r = Req 'PATCH' "$base/rest/v1/fish?id=eq.$fishId" (@{ holder = $bUserId; direction = -1; y_frac = 0.5 } | ConvertTo-Json -Compress) $A
Check 'holder can hand a fish to a room-mate' ($r.code -lt 300) "$($r.code) $($r.body)"
$moved = JArr (Req 'GET' "$base/rest/v1/fish?select=id,holder,direction,updated_at&id=eq.$fishId" $null $B).body
Check 'fish now held by the other participant' ($moved.Count -eq 1 -and $moved[0].holder -eq $bUserId) "$($moved | ConvertTo-Json -Compress)"
Check 'updated_at maintained by trigger, not the client' ($moved.Count -eq 1 -and $moved[0].updated_at) 'no updated_at'

Write-Host "`n=== 11. Join rate limit (10 failures / 15 min)"
$D = NewUser 'D'
$limitHitAt = 0
for ($i = 1; $i -le 14; $i++) {
  $s = JoinStatus (Rpc 'join_room' '{"room_code":"QQQQQQQQ"}' $D)
  if ($s -eq 'too_many_attempts') { $limitHitAt = $i; break }
  if ($s -ne 'room_not_found') { Write-Host "         unexpected status at $i : $s" }
}
Check 'rate limiter trips on the 11th attempt' ($limitHitAt -eq 11) "tripped at attempt $limitHitAt"
# A throttled caller must not be able to extend their own lockout, and a valid
# code must still be refused while throttled.
Check 'throttle also blocks a VALID code' ((JoinStatus (Rpc 'join_room' (@{ room_code = $code } | ConvertTo-Json -Compress) $D)) -eq 'too_many_attempts') 'valid code slipped through'

Write-Host "`n=== 12. leave_room releases fish and access"
$r = Rpc 'leave_room' (@{ target_room = $roomId } | ConvertTo-Json -Compress) $B
Check 'leave_room succeeds' ($r.code -lt 300) "$($r.code) $($r.body)"
Check 'participant count back to 1' ((JArr (Req 'GET' "$base/rest/v1/room_participants?select=user_id" $null $A).body).Count -eq 1) 'wrong count'
Check 'departed member can no longer see the room' ((JArr (Req 'GET' "$base/rest/v1/rooms?select=id" $null $B).body).Count -eq 0) 'still visible'
$orphan = JArr (Req 'GET' "$base/rest/v1/fish?select=id,holder&id=eq.$fishId" $null $A).body
Check 'departed member released the fish (holder now null)' ($orphan.Count -eq 1 -and $null -eq $orphan[0].holder) "$($orphan | ConvertTo-Json -Compress)"
$r = Req 'PATCH' "$base/rest/v1/fish?id=eq.$fishId" (@{ holder = ($rooms[0].id) } | ConvertTo-Json -Compress) $A
Write-Host "         (orphan reclaim by the remaining member is what Aquarium does on subscribe)"

Write-Host "`n======================================"
Write-Host "PASS: $script:pass   FAIL: $script:fail"
if ($script:fail -gt 0) { Write-Host 'RESULT: problems found' } else { Write-Host 'RESULT: all Phase 1 checks green' }
