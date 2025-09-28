#[allow(lint(coin_field))]
module challenge::quiz;

use std::string::String;
use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;

// ========= STRUCTS =========

public struct QuizNFT has key, store {
    id: UID,
    title: String,
    description: String,
    creator: address,
    media_id: String, // Walrus ID for rich content (images/videos)
    questions: vector<Question>,
    total_questions: u64,
    time_per_question: u64, // in seconds
    created_at: u64,
    // New reward system fields
    reward_type: RewardType,
    sui_reward_amount: u64, // SUI amount in MIST (1 SUI = 1,000,000,000 MIST)
    reward_distribution: RewardDistribution,
    manual_percentages: vector<u64>, // For manual distribution
    // Payment and reward system
    reward_pool_amount: u64, // Amount of SUI in reward pool
    is_payment_collected: bool, // Whether payment has been collected
    is_rewards_distributed: bool, // Whether rewards have been distributed
}

public struct Question has store, drop {
    question_text: String,
    options: vector<String>, // 4 options (A, B, C, D)
    correct_answer_hash: vector<u8>, // Hash of correct answer for security
    points: u64,
    media_id: String, // Optional media for individual questions
}

// New reward system structs
public struct RewardType has store, drop {
    reward_type: u8, // 0: Certificate, 1: SUI, 2: Both
}

public struct RewardDistribution has store, drop {
    distribution_type: u8, // 0: Top3, 1: Manual
    percentages: vector<u64>, // For manual distribution
}

public struct QuizMetadata has key, store {
    id: UID,
    timestamp: u64,
    total_quizzes_created: u64,
}

// ========= EVENTS =========

public struct QuizCreated has copy, drop {
    quiz_id: ID,
    title: String,
    creator: address,
    total_questions: u64,
    timestamp: u64,
}

public struct QuizCompleted has copy, drop {
    quiz_id: ID,
    player: address,
    score: u64,
    total_possible: u64,
    timestamp: u64,
}

public struct PaymentCollected has copy, drop {
    quiz_id: ID,
    creator: address,
    amount: u64,
    timestamp: u64,
}

public struct RewardsDistributed has copy, drop {
    quiz_id: ID,
    total_amount: u64,
    winners_count: u64,
    timestamp: u64,
}

// ========= FUNCTIONS =========

#[allow(lint(self_transfer))]
public fun create_quiz(
    _title: String,
    _description: String,
    questions: vector<Question>,
    _time_per_question: u64,
    _media_id: String,
    _reward_type: RewardType,
    _sui_reward_amount: u64,
    _reward_distribution: RewardDistribution,
    _manual_percentages: vector<u64>,
    payment: Coin<SUI>, // Payment from creator
    ctx: &mut TxContext
) {
    let total_questions = vector::length(&questions);
    
    // Verify payment amount matches reward amount
    let payment_amount = coin::value(&payment);
    assert!(payment_amount >= _sui_reward_amount, 0); // Error code 0: Insufficient payment
    
    let quiz = QuizNFT {
        id: object::new(ctx),
        title: _title,
        description: _description,
        creator: ctx.sender(),
        media_id: _media_id,
        questions,
        total_questions,
        time_per_question: _time_per_question,
        created_at: ctx.epoch_timestamp_ms(),
        reward_type: _reward_type,
        sui_reward_amount: _sui_reward_amount,
        reward_distribution: _reward_distribution,
        manual_percentages: _manual_percentages,
        reward_pool_amount: payment_amount, // Store payment amount
        is_payment_collected: true,
        is_rewards_distributed: false,
    };
    
    // Transfer payment to module (escrow)
    transfer::public_transfer(payment, @challenge);
    
    // Emit QuizCreated event
    event::emit(QuizCreated {
        quiz_id: object::id(&quiz),
        title: quiz.title,
        creator: ctx.sender(),
        total_questions,
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    // Emit PaymentCollected event
    event::emit(PaymentCollected {
        quiz_id: object::id(&quiz),
        creator: ctx.sender(),
        amount: payment_amount,
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    // Transfer quiz to creator
    transfer::public_transfer(quiz, ctx.sender());
    
    // Create and freeze metadata
    let metadata = QuizMetadata {
        id: object::new(ctx),
        timestamp: ctx.epoch_timestamp_ms(),
        total_quizzes_created: 1, // This would be incremented in a real implementation
    };
    transfer::freeze_object(metadata);
}

// Helper function to create a question
public fun create_question(
    question_text: String,
    options: vector<String>,
    correct_answer_hash: vector<u8>,
    points: u64,
    media_id: String
): Question {
    Question {
        question_text,
        options,
        correct_answer_hash,
        points,
        media_id,
    }
}

// Helper function to create reward type
public fun create_reward_type(reward_type: u8): RewardType {
    RewardType {
        reward_type,
    }
}

// Helper function to create reward distribution
public fun create_reward_distribution(distribution_type: u8, percentages: vector<u64>): RewardDistribution {
    RewardDistribution {
        distribution_type,
        percentages,
    }
}

// Function to submit quiz answers and calculate score
public fun submit_quiz_answers(
    quiz: QuizNFT,
    answers: vector<u8>, // Array of answer indices (0-3 for A-D)
    ctx: &mut TxContext
) {
    let QuizNFT { 
        id, 
        title: _, 
        description: _, 
        creator: _, 
        media_id: _, 
        questions, 
        total_questions: _, 
        time_per_question: _, 
        created_at: _,
        reward_type: _,
        sui_reward_amount: _,
        reward_distribution: _,
        manual_percentages: _,
        reward_pool_amount: _,
        is_payment_collected: _,
        is_rewards_distributed: _
    } = quiz;
    
    let mut score = 0;
    let mut total_possible = 0;
    let mut i = 0;
    
    // Calculate score based on answers
    while (i < vector::length(&questions) && i < vector::length(&answers)) {
        let question = vector::borrow(&questions, i);
        let answer_index = *vector::borrow(&answers, i);
        
        // Add to total possible points
        total_possible = total_possible + question.points;
        
        // Check if answer is correct (simplified - in real implementation, 
        // you'd hash the selected option and compare with correct_answer_hash)
        if (answer_index < (vector::length(&question.options) as u8)) {
            // For demo purposes, we'll assume first option is always correct
            // In real implementation, you'd verify against the hash
            if (answer_index == 0) {
                score = score + question.points;
            };
        };
        
        i = i + 1;
    };
    
    // Emit QuizCompleted event
    event::emit(QuizCompleted {
        quiz_id: object::uid_to_inner(&id),
        player: ctx.sender(),
        score,
        total_possible,
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    // Delete the quiz object
    object::delete(id);
}

// Function to distribute rewards to winners
public fun distribute_rewards(
    quiz: &mut QuizNFT,
    winners: vector<address>,
    amounts: vector<u64>, // Reward amounts for each winner
    ctx: &mut TxContext
) {
    // Only creator can distribute rewards
    assert!(quiz.creator == ctx.sender(), 1); // Error code 1: Unauthorized
    assert!(!quiz.is_rewards_distributed, 2); // Error code 2: Rewards already distributed
    assert!(quiz.is_payment_collected, 3); // Error code 3: Payment not collected
    
    let winners_count = vector::length(&winners);
    let amounts_count = vector::length(&amounts);
    assert!(winners_count == amounts_count, 4); // Error code 4: Winners and amounts mismatch
    
    let mut total_distributed = 0;
    let mut i = 0;
    
    // Calculate total to distribute
    while (i < amounts_count) {
        let amount = *vector::borrow(&amounts, i);
        total_distributed = total_distributed + amount;
        i = i + 1;
    };
    
    // Verify we have enough in reward pool
    assert!(total_distributed <= quiz.reward_pool_amount, 5); // Error code 5: Insufficient reward pool
    
    // Mark rewards as distributed
    quiz.is_rewards_distributed = true;
    quiz.reward_pool_amount = quiz.reward_pool_amount - total_distributed;
    
    // Emit RewardsDistributed event
    event::emit(RewardsDistributed {
        quiz_id: object::id(quiz),
        total_amount: total_distributed,
        winners_count,
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

// Function to refund remaining rewards to creator (if any)
public fun refund_remaining_rewards(
    quiz: &mut QuizNFT,
    ctx: &mut TxContext
) {
    // Only creator can refund
    assert!(quiz.creator == ctx.sender(), 1); // Error code 1: Unauthorized
    assert!(quiz.is_rewards_distributed, 5); // Error code 5: Rewards not distributed yet
    
    let remaining_amount = quiz.reward_pool_amount;
    if (remaining_amount > 0) {
        // Reset reward pool amount
        quiz.reward_pool_amount = 0;
        
        // Emit refund event (actual transfer handled by backend)
        event::emit(RewardsDistributed {
            quiz_id: object::id(quiz),
            total_amount: remaining_amount,
            winners_count: 1, // Creator gets refund
            timestamp: ctx.epoch_timestamp_ms(),
        });
    };
}

// ========= GETTER FUNCTIONS =========

public fun quiz_title(quiz: &QuizNFT): String {
    quiz.title
}

public fun quiz_description(quiz: &QuizNFT): String {
    quiz.description
}

public fun quiz_creator(quiz: &QuizNFT): address {
    quiz.creator
}

public fun quiz_total_questions(quiz: &QuizNFT): u64 {
    quiz.total_questions
}

public fun quiz_time_per_question(quiz: &QuizNFT): u64 {
    quiz.time_per_question
}

public fun quiz_media_id(quiz: &QuizNFT): String {
    quiz.media_id
}

public fun quiz_created_at(quiz: &QuizNFT): u64 {
    quiz.created_at
}

public fun quiz_reward_type(quiz: &QuizNFT): u8 {
    quiz.reward_type.reward_type
}

public fun quiz_sui_reward_amount(quiz: &QuizNFT): u64 {
    quiz.sui_reward_amount
}

public fun quiz_reward_distribution_type(quiz: &QuizNFT): u8 {
    quiz.reward_distribution.distribution_type
}

public fun quiz_manual_percentages(quiz: &QuizNFT): vector<u64> {
    quiz.manual_percentages
}

public fun quiz_reward_pool_value(quiz: &QuizNFT): u64 {
    quiz.reward_pool_amount
}

public fun quiz_is_payment_collected(quiz: &QuizNFT): bool {
    quiz.is_payment_collected
}

public fun quiz_is_rewards_distributed(quiz: &QuizNFT): bool {
    quiz.is_rewards_distributed
}

// ========= TEST FUNCTIONS =========

#[test_only]
public fun quiz_id(quiz: &QuizNFT): ID {
    object::id(quiz)
}

#[test_only]
public fun get_question_text(question: &Question): String {
    question.question_text
}

#[test_only]
public fun get_question_options(question: &Question): vector<String> {
    question.options
}

#[test_only]
public fun get_question_points(question: &Question): u64 {
    question.points
}
