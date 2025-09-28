module challenge::badge;

use std::string::String;
use sui::event;

// ========= STRUCTS =========

public struct BadgeNFT has key, store {
    id: UID,
    badge_type: BadgeType,
    quiz_id: ID,
    quiz_title: String,
    winner: address,
    score: u64,
    total_possible: u64,
    completion_time: u64, // Time taken to complete quiz in seconds
    earned_at: u64,
    is_sealed: bool, // Official certificate status
    sealed_by: address, // Who sealed the badge (quiz creator)
    sealed_at: u64, // When it was sealed
    media_id: String, // Badge image/design from Walrus
    // New reward fields
    sui_reward_amount: u64, // SUI reward amount in MIST
    position: u64, // Position in leaderboard (1st, 2nd, 3rd, etc.)
    reward_percentage: u64, // Percentage of total reward pool
}

public struct BadgeType has store, drop {
    name: String,
    description: String,
    rarity: BadgeRarity,
    required_score_percentage: u64, // Minimum score percentage to earn this badge
}

public struct BadgeRarity has store, drop {
    level: u8, // 1-5 (Common, Uncommon, Rare, Epic, Legendary)
    color: String, // Hex color code for UI
}

// ========= CAPABILITIES =========

public struct BadgeAdminCap has key, store {
    id: UID,
}

// ========= EVENTS =========

public struct BadgeMinted has copy, drop {
    badge_id: ID,
    badge_type: String,
    quiz_id: ID,
    winner: address,
    score: u64,
    total_possible: u64,
    timestamp: u64,
}

public struct BadgeSealed has copy, drop {
    badge_id: ID,
    quiz_id: ID,
    winner: address,
    sealed_by: address,
    timestamp: u64,
}

// ========= FUNCTIONS =========

fun init(ctx: &mut TxContext) {
    // Initialize the module by creating BadgeAdminCap
    let admin_cap = BadgeAdminCap {
        id: object::new(ctx),
    };
    
    // Transfer it to the module publisher
    transfer::public_transfer(admin_cap, ctx.sender());
}

// Mint a badge for quiz completion
public fun mint_winner_badge(
    badge_type: BadgeType,
    quiz_id: ID,
    quiz_title: String,
    winner: address,
    score: u64,
    total_possible: u64,
    completion_time: u64,
    media_id: String,
    sui_reward_amount: u64,
    position: u64,
    reward_percentage: u64,
    ctx: &mut TxContext
) {
    // Calculate score percentage
    let score_percentage = (score * 100) / total_possible;
    
    // Check if score meets badge requirements
    assert!(score_percentage >= badge_type.required_score_percentage, 0);
    
    let badge = BadgeNFT {
        id: object::new(ctx),
        badge_type,
        quiz_id,
        quiz_title,
        winner,
        score,
        total_possible,
        completion_time,
        earned_at: ctx.epoch_timestamp_ms(),
        is_sealed: false,
        sealed_by: @0x0, // Default to zero address
        sealed_at: 0,
        media_id,
        sui_reward_amount,
        position,
        reward_percentage,
    };
    
    // Emit BadgeMinted event
    event::emit(BadgeMinted {
        badge_id: object::id(&badge),
        badge_type: badge.badge_type.name,
        quiz_id,
        winner,
        score,
        total_possible,
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    // Transfer badge to winner
    transfer::public_transfer(badge, winner);
}

// Seal a badge to make it an official certificate (only quiz creator can do this)
public fun seal_badge(
    badge: &mut BadgeNFT,
    quiz_creator: address,
    ctx: &mut TxContext
) {
    // Only allow sealing if not already sealed
    assert!(!badge.is_sealed, 1);
    
    // Update badge to sealed status
    badge.is_sealed = true;
    badge.sealed_by = quiz_creator;
    badge.sealed_at = ctx.epoch_timestamp_ms();
    
    // Emit BadgeSealed event
    event::emit(BadgeSealed {
        badge_id: object::id(badge),
        quiz_id: badge.quiz_id,
        winner: badge.winner,
        sealed_by: quiz_creator,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

// Create a badge type
public fun create_badge_type(
    name: String,
    description: String,
    rarity_level: u8,
    color: String,
    required_score_percentage: u64
): BadgeType {
    let rarity = BadgeRarity {
        level: rarity_level,
        color,
    };
    
    BadgeType {
        name,
        description,
        rarity,
        required_score_percentage,
    }
}

// ========= GETTER FUNCTIONS =========

public fun badge_type_name(badge: &BadgeNFT): String {
    badge.badge_type.name
}

public fun badge_quiz_id(badge: &BadgeNFT): ID {
    badge.quiz_id
}

public fun badge_winner(badge: &BadgeNFT): address {
    badge.winner
}

public fun badge_score(badge: &BadgeNFT): u64 {
    badge.score
}

public fun badge_total_possible(badge: &BadgeNFT): u64 {
    badge.total_possible
}

public fun badge_completion_time(badge: &BadgeNFT): u64 {
    badge.completion_time
}

public fun badge_earned_at(badge: &BadgeNFT): u64 {
    badge.earned_at
}

public fun badge_is_sealed(badge: &BadgeNFT): bool {
    badge.is_sealed
}

public fun badge_sealed_by(badge: &BadgeNFT): address {
    badge.sealed_by
}

public fun badge_sealed_at(badge: &BadgeNFT): u64 {
    badge.sealed_at
}

public fun badge_media_id(badge: &BadgeNFT): String {
    badge.media_id
}

public fun badge_rarity_level(badge: &BadgeNFT): u8 {
    badge.badge_type.rarity.level
}

public fun badge_rarity_color(badge: &BadgeNFT): String {
    badge.badge_type.rarity.color
}

public fun badge_sui_reward_amount(badge: &BadgeNFT): u64 {
    badge.sui_reward_amount
}

public fun badge_position(badge: &BadgeNFT): u64 {
    badge.position
}

public fun badge_reward_percentage(badge: &BadgeNFT): u64 {
    badge.reward_percentage
}

// ========= TEST FUNCTIONS =========

#[test_only]
public fun badge_id(badge: &BadgeNFT): ID {
    object::id(badge)
}

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    let admin_cap = BadgeAdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, ctx.sender());
}

#[test_only]
public fun create_test_badge_type(): BadgeType {
    create_badge_type(
        string::utf8(b"Quiz Master"),
        string::utf8(b"Completed a quiz with 80% or higher score"),
        3, // Rare
        string::utf8(b"#FFD700"), // Gold color
        80 // 80% required
    )
}
