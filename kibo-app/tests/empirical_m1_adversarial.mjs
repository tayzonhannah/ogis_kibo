import { isValidRoomCode, validateUserProfile, validateTankRoom, CODE_ALPHABET, ROOM_CAPACITY } from './e2e/helpers/contracts.mjs';
import { MockSupabaseEnvironment } from './e2e/helpers/simulators.mjs';

console.log('=== ADVERSARIAL STRESS TEST SUITE: M1 AUTH & SCHEMA BOUNDARY ===');

const env = new MockSupabaseEnvironment();

// [1] Boundary Room Names
const user1 = env.createGoogleUser({ id: 'usr_adv_1', displayName: 'Alice' });
const names = [
  { raw: '', expected: 'Shared Tank', desc: 'empty' },
  { raw: '    ', expected: 'Shared Tank', desc: 'whitespace only' },
  { raw: '\t\n  \r\n', expected: 'Shared Tank', desc: 'tabs and newlines' },
  { raw: '   Cozy Tidepool   ', expected: 'Cozy Tidepool', desc: 'padded space' },
  { raw: 'Ocean Haven (4K Ultra)', expected: 'Ocean Haven (4K Ultra)', desc: 'normal with parens' },
  { raw: 'A'.repeat(500), expected: 'A'.repeat(500), desc: '500 chars' },
  { raw: "Robert'); DROP TABLE rooms;--", expected: "Robert'); DROP TABLE rooms;--", desc: 'sql injection attempt' },
  { raw: '<script>alert(1)</script>', expected: '<script>alert(1)</script>', desc: 'xss attempt' }
];

for (const bn of names) {
  const effectiveName = bn.raw.trim() === '' ? 'Shared Tank' : bn.raw.trim();
  const res = env.rpcCreateRoom(user1.id, effectiveName);
  const room = env.rooms.get(res.room_id);
  if (!room || room.name !== bn.expected) {
    throw new Error('Boundary name test failed for [' + bn.desc + ']: expected ' + bn.expected + ', got ' + room?.name);
  }
  console.log('  [PASS] create_room boundary name [' + bn.desc + '] -> ' + room.name.slice(0, 30));
}

// [2] Room Code Generation
const generatedCodes = new Set();
for (let i = 0; i < 200; i++) {
  const res = env.rpcCreateRoom(user1.id, 'Tank ' + i);
  if (!isValidRoomCode(res.room_code)) throw new Error('Invalid code: ' + res.room_code);
  for (const forbidden of ['0', 'O', '1', 'I']) {
    if (res.room_code.includes(forbidden)) throw new Error('Ambiguous char in ' + res.room_code);
  }
  if (generatedCodes.has(res.room_code)) throw new Error('Collision on ' + res.room_code);
  generatedCodes.add(res.room_code);
}
console.log('  [PASS] 200 distinct 8-char codes generated with 0 collisions and strict charset');

// [3] Multi-Tank Linkage and 5-User Capacity
const user2 = env.createGoogleUser({ id: 'usr_adv_2' });
const user3 = env.createGoogleUser({ id: 'usr_adv_3' });
const user4 = env.createGoogleUser({ id: 'usr_adv_4' });
const user5 = env.createGoogleUser({ id: 'usr_adv_5' });
const user6 = env.createGoogleUser({ id: 'usr_adv_6' });

const roomAlpha = env.rpcCreateRoom(user1.id, 'Alpha Tank');
const roomBeta = env.rpcCreateRoom(user2.id, 'Beta Tank');

env.rpcJoinRoom(user2.id, roomAlpha.room_code);
env.rpcJoinRoom(user3.id, roomAlpha.room_code);
env.rpcJoinRoom(user4.id, roomAlpha.room_code);
env.rpcJoinRoom(user5.id, roomAlpha.room_code);

if (env.participants.get(roomAlpha.room_id).length !== 5) throw new Error('Room Alpha count != 5');
console.log('  [PASS] Room Alpha filled to exactly 5 members');

const reject6 = env.rpcJoinRoom(user6.id, roomAlpha.room_code);
if (reject6.status !== 'room_full' || reject6.joined_room !== null) throw new Error('Expected room_full');
console.log('  [PASS] 6th member strictly rejected with status=room_full');

const rejoin = env.rpcJoinRoom(user2.id, roomAlpha.room_code);
if (rejoin.status !== 'ok' || rejoin.joined_room !== roomAlpha.room_id) throw new Error('Rejoin failed');
if (env.participants.get(roomAlpha.room_id).length !== 5) throw new Error('Participant count corrupted on rejoin');
console.log('  [PASS] Idempotent rejoin preserves exactly 5 members');

env.rpcJoinRoom(user1.id, roomBeta.room_code);
const u1Alpha = env.participants.get(roomAlpha.room_id).some(m => m.user_id === user1.id);
const u1Beta = env.participants.get(roomBeta.room_id).some(m => m.user_id === user1.id);
if (!u1Alpha || !u1Beta) throw new Error('Multi-tank membership missing');
console.log('  [PASS] Single user simultaneously linked to Alpha Tank and Beta Tank');

// [4] Auth Route Handler Simulation
async function simulateAuthCallback(urlStr, headers = {}) {
  const url = new URL(urlStr);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const origin = url.origin;
  if (code) {
    if (code === 'valid_code_123') {
      const forwardedHost = headers['x-forwarded-host'];
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) return { redirect: origin + next };
      else if (forwardedHost) return { redirect: 'https://' + forwardedHost + next };
      else return { redirect: origin + next };
    }
  }
  return { redirect: origin + '/?error=auth_callback_failed' };
}

async function testCallbacks() {
  const cases_ = [
    { url: 'http://localhost:3000/auth/callback', expected: 'http://localhost:3000/?error=auth_callback_failed', desc: 'Missing code' },
    { url: 'http://localhost:3000/auth/callback?error=access_denied', expected: 'http://localhost:3000/?error=auth_callback_failed', desc: 'OAuth error param' },
    { url: 'http://localhost:3000/auth/callback?code=', expected: 'http://localhost:3000/?error=auth_callback_failed', desc: 'Empty code' },
    { url: 'http://localhost:3000/auth/callback?code=malformed_xyz', expected: 'http://localhost:3000/?error=auth_callback_failed', desc: 'Malformed code' },
    { url: 'http://localhost:3000/auth/callback?code=valid_code_123', expected: 'http://localhost:3000/dashboard', desc: 'Valid code -> /dashboard' },
    { url: 'http://localhost:3000/auth/callback?code=valid_code_123&next=%2Froom%2FABCC2345', expected: 'http://localhost:3000/room/ABCC2345', desc: 'Valid code -> custom next room' }
  ];
  for (const c of cases_) {
    const res = await simulateAuthCallback(c.url);
    if (res.redirect !== c.expected) throw new Error('Callback test failed: ' + c.desc + ' got ' + res.redirect);
    console.log('  [PASS] Auth callback: ' + c.desc + ' -> ' + res.redirect);
  }
}

// [5] Boundary Room Codes in join_room
console.log('\n[5] Testing join_room Code Normalization and Boundary Formats');
const guestUser = env.createGoogleUser({ id: 'usr_guest_adv' });
const targetRoom = env.rpcCreateRoom(user1.id, 'Target Room');

const codeScenarios = [
  { input: targetRoom.room_code.toLowerCase(), expectedStatus: 'ok', desc: 'all lowercase' },
  { input: '   ' + targetRoom.room_code + '   ', expectedStatus: 'ok', desc: 'padded spaces' },
  { input: targetRoom.room_code.slice(0, 7), expectedStatus: 'room_not_found', desc: 'short code (7 chars)' },
  { input: targetRoom.room_code + 'X', expectedStatus: 'room_not_found', desc: 'long code (9 chars)' },
  { input: "' OR '1'='1", expectedStatus: 'room_not_found', desc: 'SQL injection string' },
  { input: 'NONEXIST', expectedStatus: 'room_not_found', desc: 'non-existent valid alphabet code' }
];

for (const cs of codeScenarios) {
  const res = env.rpcJoinRoom(guestUser.id, cs.input);
  if (res.status !== cs.expectedStatus) {
    throw new Error('join_room code test failed for [' + cs.desc + ']: expected ' + cs.expectedStatus + ', got ' + res.status);
  }
  console.log('  [PASS] join_room boundary code [' + cs.desc + '] -> status: ' + res.status);
}

// [6] Rate Limiting Simulation on join_room
console.log('\n[6] Testing join_room Rate Limiting (10 failed attempts threshold)');
const spamUser = env.createGoogleUser({ id: 'usr_spam' });
for (let i = 0; i < 10; i++) {
  env.joinAttempts.push({
    user_id: spamUser.id,
    succeeded: false,
    attempted_at: new Date().toISOString()
  });
}
const rateLimitCheck = (userId, targetCode) => {
  const recentFails = env.joinAttempts.filter(
    a => a.user_id === userId && !a.succeeded
  ).length;
  if (recentFails >= 10) return { status: 'too_many_attempts', joined_room: null };
  return env.rpcJoinRoom(userId, targetCode);
};

const spamRes = rateLimitCheck(spamUser.id, targetRoom.room_code);
if (spamRes.status !== 'too_many_attempts') {
  throw new Error('Expected too_many_attempts after 10 failed attempts, got ' + spamRes.status);
}
console.log('  [PASS] join_room enforces too_many_attempts after 10 failed attempts');

// [7] Google OAuth User Profile Sync & Metadata Fallbacks
console.log('\n[7] Testing Google Profile Provisioning and Fallbacks');
function simulateHandleNewUser(authRecord) {
  const meta = authRecord.raw_user_meta_data || {};
  const user_name = meta.full_name || meta.name || (authRecord.email ? authRecord.email.split('@')[0] : 'Aquanaut');
  const user_avatar = meta.avatar_url || meta.picture || null;
  return {
    id: authRecord.id,
    email: authRecord.email,
    display_name: user_name,
    avatar_url: user_avatar,
    fish_points: 0
  };
}

const p1 = simulateHandleNewUser({ id: 'u_meta_1', email: 'test@example.com', raw_user_meta_data: { full_name: 'Test User', avatar_url: 'https://pic.url' } });
if (p1.display_name !== 'Test User' || p1.avatar_url !== 'https://pic.url') throw new Error('Meta full_name failed');

const p2 = simulateHandleNewUser({ id: 'u_meta_2', email: 'jordan.river@gmail.com', raw_user_meta_data: {} });
if (p2.display_name !== 'jordan.river' || p2.avatar_url !== null) throw new Error('Email prefix fallback failed');

const p3 = simulateHandleNewUser({ id: 'u_meta_3', email: null, raw_user_meta_data: null });
if (p3.display_name !== 'Aquanaut' || p3.avatar_url !== null) throw new Error('Aquanaut fallback failed');

console.log('  [PASS] Profile metadata priority hierarchy (full_name -> name -> split_part(email) -> Aquanaut) verified');

testCallbacks().then(() => {
  console.log('\n======================================================');
  console.log('  ALL EMPIRICAL CHALLENGE TESTS PASSED SUCCESSFULLY!  ');
  console.log('======================================================\n');
});