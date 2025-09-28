module challenge::quiz_room;

use challenge::quiz::{Self, QuizNFT};
use std::string::String;
use sui::event;

// ========= STRUCTS =========

public struct QuizRoom has key, store {
    id: UID,
    quiz: QuizNFT,
    room_code: String, // 6-digit room code for players to join
    host: address,
    max_players: u64,
    current_players: u64,
    players: vector<Player>,
    game_state: GameState,
    current_question: u64,
    time_remaining: u64, // seconds
    created_at: u64,
    started_at: u64,
}

public struct Player has store, drop {
    address: address,
    nickname: String,
    score: u64,
    answers: vector<u8>, // Player's answers (0-3 for A-D)
    joined_at: u64,
    is_ready: bool,
}

public struct GameState has store {
    status: u8, // 0: Waiting, 1: In Progress, 2: Finished
    question_start_time: u64,
    leaderboard: vector<LeaderboardEntry>,
}

public struct LeaderboardEntry has store {
    player_address: address,
    nickname: String,
    score: u64,
    position: u64,
}

// ========= EVENTS =========

public struct QuizRoomCreated has copy, drop {
    room_id: ID,
    room_code: String,
    host: address,
    quiz_title: String,
    max_players: u64,
    timestamp: u64,
}

public struct PlayerJoined has copy, drop {
    room_id: ID,
    player: address,
    nickname: String,
    current_players: u64,
    timestamp: u64,
}

public struct PlayerLeft has copy, drop {
    room_id: ID,
    player: address,
    current_players: u64,
    timestamp: u64,
}

public struct QuizStarted has copy, drop {
    room_id: ID,
    host: address,
    total_players: u64,
    timestamp: u64,
}

public struct QuestionAnswered has copy, drop {
    room_id: ID,
    player: address,
    question_index: u64,
    answer: u8,
    timestamp: u64,
}

public struct QuizCompleted has copy, drop {
    room_id: ID,
    winner: address,
    winner_score: u64,
    total_players: u64,
    timestamp: u64,
}

// ========= FUNCTIONS =========

public fun create_quiz_room(
    quiz: QuizNFT,
    max_players: u64,
    ctx: &mut TxContext
) {
    let room_code = generate_room_code();
    
    let quiz_room = QuizRoom {
        id: object::new(ctx),
        quiz,
        room_code,
        host: ctx.sender(),
        max_players,
        current_players: 0,
        players: vector::empty(),
        game_state: GameState {
            status: 0, // Waiting
            question_start_time: 0,
            leaderboard: vector::empty(),
        },
        current_question: 0,
        time_remaining: 0,
        created_at: ctx.epoch_timestamp_ms(),
        started_at: 0,
    };
    
    // Emit QuizRoomCreated event
    event::emit(QuizRoomCreated {
        room_id: object::id(&quiz_room),
        room_code: quiz_room.room_code,
        host: ctx.sender(),
        quiz_title: quiz::quiz_title(&quiz_room.quiz),
        max_players,
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    // Make room publicly accessible
    transfer::share_object(quiz_room);
}

public fun join_quiz_room(
    room: &mut QuizRoom,
    nickname: String,
    ctx: &mut TxContext
) {
    // Check if room is not full
    assert!(room.current_players < room.max_players, 0);
    
    // Check if game hasn't started yet
    assert!(room.game_state.status == 0, 1);
    
    // Check if player is not already in the room
    let mut i = 0;
    while (i < vector::length(&room.players)) {
        let player = vector::borrow(&room.players, i);
        assert!(player.address != ctx.sender(), 2);
        i = i + 1;
    };
    
    // Create new player
    let new_player = Player {
        address: ctx.sender(),
        nickname,
        score: 0,
        answers: vector::empty(),
        joined_at: ctx.epoch_timestamp_ms(),
        is_ready: false,
    };
    
    // Add player to room
    vector::push_back(&mut room.players, new_player);
    room.current_players = room.current_players + 1;
    
    // Emit PlayerJoined event
    event::emit(PlayerJoined {
        room_id: object::id(room),
        player: ctx.sender(),
        nickname,
        current_players: room.current_players,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

public fun leave_quiz_room(
    room: &mut QuizRoom,
    ctx: &mut TxContext
) {
    let mut i = 0;
    let mut found = false;
    
    // Find and remove player
    while (i < vector::length(&room.players)) {
        let player = vector::borrow(&room.players, i);
        if (player.address == ctx.sender()) {
            vector::remove(&mut room.players, i);
            room.current_players = room.current_players - 1;
            found = true;
            break
        };
        i = i + 1;
    };
    
    assert!(found, 3);
    
    // Emit PlayerLeft event
    event::emit(PlayerLeft {
        room_id: object::id(room),
        player: ctx.sender(),
        current_players: room.current_players,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

public fun start_quiz(
    room: &mut QuizRoom,
    ctx: &mut TxContext
) {
    // Only host can start the quiz
    assert!(room.host == ctx.sender(), 4);
    
    // Check if there are players
    assert!(room.current_players > 0, 5);
    
    // Check if game hasn't started yet
    assert!(room.game_state.status == 0, 6);
    
    // Start the quiz
    room.game_state.status = 1; // In Progress
    room.started_at = ctx.epoch_timestamp_ms();
    room.current_question = 0;
    room.time_remaining = quiz::quiz_time_per_question(&room.quiz);
    room.game_state.question_start_time = ctx.epoch_timestamp_ms();
    
    // Emit QuizStarted event
    event::emit(QuizStarted {
        room_id: object::id(room),
        host: ctx.sender(),
        total_players: room.current_players,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

public fun submit_answer(
    room: &mut QuizRoom,
    question_index: u64,
    answer: u8,
    ctx: &mut TxContext
) {
    // Check if game is in progress
    assert!(room.game_state.status == 1, 7);
    
    // Check if it's the current question
    assert!(question_index == room.current_question, 8);
    
    // Find player and update their answer
    let mut i = 0;
    let mut found = false;
    
    while (i < vector::length(&room.players)) {
        let player = vector::borrow_mut(&mut room.players, i);
        if (player.address == ctx.sender()) {
            // Add answer to player's answers
            vector::push_back(&mut player.answers, answer);
            found = true;
            break
        };
        i = i + 1;
    };
    
    assert!(found, 9);
    
    // Emit QuestionAnswered event
    event::emit(QuestionAnswered {
        room_id: object::id(room),
        player: ctx.sender(),
        question_index,
        answer,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

public fun next_question(
    room: &mut QuizRoom,
    ctx: &mut TxContext
) {
    // Only host can move to next question
    assert!(room.host == ctx.sender(), 10);
    
    // Check if game is in progress
    assert!(room.game_state.status == 1, 11);
    
    // Move to next question
    room.current_question = room.current_question + 1;
    room.time_remaining = quiz::quiz_time_per_question(&room.quiz);
    room.game_state.question_start_time = ctx.epoch_timestamp_ms();
    
    // Check if quiz is finished
    if (room.current_question >= quiz::quiz_total_questions(&room.quiz)) {
        finish_quiz(room, ctx);
    };
}

public fun finish_quiz(
    room: &mut QuizRoom,
    ctx: &mut TxContext
) {
    room.game_state.status = 2; // Finished
    
    // Calculate final scores and create leaderboard
    let mut i = 0;
    while (i < vector::length(&room.players)) {
        let player = vector::borrow(&room.players, i);
        let leaderboard_entry = LeaderboardEntry {
            player_address: player.address,
            nickname: player.nickname,
            score: player.score,
            position: 0, // Will be calculated later
        };
        vector::push_back(&mut room.game_state.leaderboard, leaderboard_entry);
        i = i + 1;
    };
    
    // Sort leaderboard by score (simple bubble sort for demo)
    let mut j = 0;
    while (j < vector::length(&room.game_state.leaderboard)) {
        let mut k = j + 1;
        while (k < vector::length(&room.game_state.leaderboard)) {
            let entry_j = vector::borrow(&room.game_state.leaderboard, j);
            let entry_k = vector::borrow(&room.game_state.leaderboard, k);
            if (entry_k.score > entry_j.score) {
                // Swap entries
                let temp = vector::remove(&mut room.game_state.leaderboard, k);
                vector::insert(&mut room.game_state.leaderboard, temp, j);
            };
            k = k + 1;
        };
        j = j + 1;
    };
    
    // Update positions in leaderboard
    i = 0;
    while (i < vector::length(&room.game_state.leaderboard)) {
        let entry = vector::borrow_mut(&mut room.game_state.leaderboard, i);
        entry.position = i + 1;
        i = i + 1;
    };
    
    // Find winner
    let mut winner_address = @0x0;
    let mut winner_score = 0;
    if (vector::length(&room.game_state.leaderboard) > 0) {
        let winner_entry = vector::borrow(&room.game_state.leaderboard, 0);
        winner_address = winner_entry.player_address;
        winner_score = winner_entry.score;
    };
    
    // Emit QuizCompleted event
    event::emit(QuizCompleted {
        room_id: object::id(room),
        winner: winner_address,
        winner_score,
        total_players: room.current_players,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

// Helper function to generate room code
fun generate_room_code(): String {
    // In a real implementation, this would generate a random 6-digit code
    // For now, we'll use a placeholder
    std::string::utf8(b"123456")
}

// ========= GETTER FUNCTIONS =========

public fun room_code(room: &QuizRoom): String {
    room.room_code
}

public fun room_host(room: &QuizRoom): address {
    room.host
}

public fun room_max_players(room: &QuizRoom): u64 {
    room.max_players
}

public fun room_current_players(room: &QuizRoom): u64 {
    room.current_players
}

public fun room_game_state(room: &QuizRoom): u8 {
    room.game_state.status
}

public fun room_current_question(room: &QuizRoom): u64 {
    room.current_question
}

public fun room_time_remaining(room: &QuizRoom): u64 {
    room.time_remaining
}

// ========= TEST FUNCTIONS =========

#[test_only]
public fun room_id(room: &QuizRoom): ID {
    object::id(room)
}
