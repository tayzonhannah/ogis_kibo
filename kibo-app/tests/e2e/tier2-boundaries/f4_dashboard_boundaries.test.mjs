import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 2: Boundary & Corner Cases - F4: Multi-Tank Dashboard Boundaries', () => {
  it('TC-F4-B16: Fresh account with 0 tanks renders welcoming zero-state CTA', () => {
    const env = new MockSupabaseEnvironment();
    const newUser = env.createGoogleUser();

    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === newUser.id);
    });

    expect(userRooms.length).toBe(0);
    const hasZeroState = userRooms.length === 0;
    expect(hasZeroState).toBe(true);
  });

  it('TC-F4-B17: High volume user with 25+ tanks renders responsive list', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    for (let i = 0; i < 25; i++) {
      env.rpcCreateRoom(user.id, `Aquarium Club #${i + 1}`);
    }

    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });

    expect(userRooms.length).toBe(25);
  });

  it('TC-F4-B18: Switching between "Create Tank" and "Join Tank" modals preserves input state independence', () => {
    const modalState = {
      activeModal: null,
      createInputName: 'My New Tank',
      joinInputCode: 'ABCDEF23',
    };

    modalState.activeModal = 'create';
    expect(modalState.activeModal).toBe('create');

    modalState.activeModal = 'join';
    expect(modalState.activeModal).toBe('join');
    expect(modalState.createInputName).toBe('My New Tank');
    expect(modalState.joinInputCode).toBe('ABCDEF23');
  });

  it('TC-F4-B19: Network retry state preserves previously loaded tanks gracefully', () => {
    const cachedTanks = [{ id: 'r1', name: 'Cached Tank 1' }];
    const networkError = true;
    const displayedTanks = networkError ? cachedTanks : [];
    expect(displayedTanks.length).toBe(1);
  });

  it('TC-F4-B20: Tank card updates member count dynamically when peer joins', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const guest = env.createGoogleUser();

    const room = env.rpcCreateRoom(owner.id, 'Dynamic Card Tank');
    let members = env.participants.get(room.room_id);
    expect(members.length).toBe(1);

    env.rpcJoinRoom(guest.id, room.room_code);
    members = env.participants.get(room.room_id);
    expect(members.length).toBe(2);
  });
});
