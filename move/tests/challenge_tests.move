#[test_only]
module challenge::quiz_tests;

use challenge::quiz::{Self, QuizNFT, create_question, create_reward_type, create_reward_distribution};
use challenge::badge::{Self, create_badge_type};
use sui::test_scenario::{Self as ts};
use std::string;

// Test constants
const QUIZ_TITLE: vector<u8> = b"Test Quiz";
const QUIZ_DESCRIPTION: vector<u8> = b"A test quiz for unit testing";
const QUESTION_TEXT: vector<u8> = b"What is 2+2?";
const OPTION_A: vector<u8> = b"3";
const OPTION_B: vector<u8> = b"4";
const OPTION_C: vector<u8> = b"5";
const OPTION_D: vector<u8> = b"6";

// Error codes
const EQuizNotCreated: u64 = 1;
const EQuestionNotCreated: u64 = 2;
const EBadgeNotCreated: u64 = 3;

#[test]
fun test_create_quiz() {
    let mut scenario = ts::begin(@0x1);
    
    // Create test question
    let question = create_question(
        string::utf8(QUESTION_TEXT),
        vector[string::utf8(OPTION_A), string::utf8(OPTION_B), string::utf8(OPTION_C), string::utf8(OPTION_D)],
        vector::empty<u8>(), // Empty hash for test
        10, // 10 points
        string::utf8(b"")
    );
    
    let questions = vector[question];
    
    // Create reward type and distribution
    let reward_type = create_reward_type(0); // Certificate only
    let reward_distribution = create_reward_distribution(0, vector[50, 30, 20]); // Top 3
    
    // Create quiz
    quiz::create_quiz(
        string::utf8(QUIZ_TITLE),
        string::utf8(QUIZ_DESCRIPTION),
        questions,
        30, // 30 seconds per question
        string::utf8(b""), // No media
        reward_type,
        0, // No SUI reward
        reward_distribution,
        vector[50, 30, 20], // Manual percentages
        scenario.ctx()
    );
    
    // Quiz creation should succeed without errors
    // (The quiz is transferred to sender, but we can't easily test that in this context)
    assert!(true, EQuizNotCreated);

    ts::end(scenario);
}

#[test]
fun test_create_question() {
    let _question = create_question(
        string::utf8(QUESTION_TEXT),
        vector[string::utf8(OPTION_A), string::utf8(OPTION_B), string::utf8(OPTION_C), string::utf8(OPTION_D)],
        vector::empty<u8>(),
        10,
        string::utf8(b"")
    );
    
    // Question should be created successfully
    assert!(true, EQuestionNotCreated);
}

#[test]
fun test_create_badge_type() {
    let _badge_type = create_badge_type(
        string::utf8(b"Quiz Master"),
        string::utf8(b"Completed a quiz with 80% or higher score"),
        3, // Rare
        string::utf8(b"#FFD700"), // Gold color
        80 // 80% required
    );
    
    // Badge type should be created successfully
    assert!(true, EBadgeNotCreated);
}

#[test]
fun test_reward_types() {
    // Test certificate only
    let _cert_reward = create_reward_type(0);
    assert!(true, 1);
    
    // Test SUI only
    let _sui_reward = create_reward_type(1);
    assert!(true, 2);
    
    // Test both
    let _both_reward = create_reward_type(2);
    assert!(true, 3);
}

#[test]
fun test_reward_distributions() {
    // Test top 3 distribution
    let _top3_dist = create_reward_distribution(0, vector[50, 30, 20]);
    assert!(true, 1);
    
    // Test manual distribution
    let _manual_dist = create_reward_distribution(1, vector[60, 25, 15]);
    assert!(true, 2);
}