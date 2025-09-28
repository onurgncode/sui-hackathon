import { useState, useEffect } from "react";
import { Box, Button, Card, Flex, Heading, Text, TextField, TextArea } from "@radix-ui/themes";
import { SuccessModal } from "./Modal";
import { useZkLogin } from "../hooks/useZkLogin";
import { useSuiWallet } from "../hooks/useSuiWallet";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  points: number;
  mediaId: string;
}

interface CreateQuizProps {
  refreshKey: number;
  setRefreshKey: (key: number) => void;
  onNavigateToLobby?: () => void;
}

export function CreateQuiz({ refreshKey, setRefreshKey, onNavigateToLobby }: CreateQuizProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [mediaId, setMediaId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{roomCode: string} | null>(null);
  const [pointsMode, setPointsMode] = useState<'auto' | 'manual'>('auto');
  const [autoPointsPerQuestion, setAutoPointsPerQuestion] = useState(10);
  const [rewardType, setRewardType] = useState<'certificate' | 'sui' | 'both'>('certificate');
  const [suiRewardAmount, setSuiRewardAmount] = useState(0);
  const [rewardDistribution, setRewardDistribution] = useState<'top3' | 'manual'>('top3');
  const [manualPercentages, setManualPercentages] = useState<number[]>([50, 30, 20]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  
  const { getAddress } = useZkLogin();
  const { signAndExecuteTransactionBlock } = useSuiWallet();

  // Check wallet balance
  const checkWalletBalance = async () => {
    const address = getAddress();
    if (!address) return;

    setIsCheckingBalance(true);
    try {
      const response = await fetch(`http://localhost:3001/api/balance/${address}`);
      if (response.ok) {
        const data = await response.json();
        setWalletBalance(data.balance || 0);
      } else {
        console.warn(`Balance check failed: HTTP ${response.status}`);
        setWalletBalance(0);
      }
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // Image upload function
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('http://localhost:3001/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        // Backend /api/upload-image returns { success, objectId, imageUrl }
        // Fall back to commonly used keys if structure changes
        const returnedObjectId = result.objectId || result.cid || result.id || '';
        setMediaId(returnedObjectId);
        console.log('Image uploaded successfully:', result);
      } else {
        const errorText = await response.text();
        throw new Error(`Upload failed: HTTP ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: pointsMode === 'auto' ? autoPointsPerQuestion : 10,
      mediaId: "",
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  // Update all questions' points when auto mode changes
  const updateAllQuestionsPoints = () => {
    if (pointsMode === 'auto') {
      const updatedQuestions = questions.map(q => ({ ...q, points: autoPointsPerQuestion }));
      setQuestions(updatedQuestions);
    }
  };

  // Update points when autoPointsPerQuestion changes
  useEffect(() => {
    if (pointsMode === 'auto') {
      updateAllQuestionsPoints();
    }
  }, [autoPointsPerQuestion, pointsMode]);

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Helper function to update manual percentages
  const updateManualPercentage = (index: number, value: number) => {
    const newPercentages = [...manualPercentages];
    newPercentages[index] = value;
    setManualPercentages(newPercentages);
  };

  // Helper function to add/remove percentage slots
  const addPercentageSlot = () => {
    setManualPercentages([...manualPercentages, 0]);
  };

  const removePercentageSlot = (index: number) => {
    if (manualPercentages.length > 1) {
      setManualPercentages(manualPercentages.filter((_, i) => i !== index));
    }
  };

  const createQuiz = async () => {
    if (!title || !description || questions.length === 0) {
      alert("Please fill in all required fields and add at least one question");
      return;
    }

    // Validate SUI reward amount if SUI is selected
    if ((rewardType === 'sui' || rewardType === 'both') && suiRewardAmount <= 0) {
      alert("Please enter a valid SUI reward amount (greater than 0)");
      return;
    }

    // Validate manual percentages if manual distribution is selected
    if (rewardDistribution === 'manual') {
      const totalPercentage = manualPercentages.reduce((sum, p) => sum + p, 0);
      if (totalPercentage !== 100) {
        alert(`Manual percentages must total 100%. Current total: ${totalPercentage}%`);
        return;
      }
      if (manualPercentages.some(p => p < 0)) {
        alert("All percentages must be positive numbers");
        return;
      }
    }

    // If SUI reward is specified, show payment confirmation
    if ((rewardType === 'sui' || rewardType === 'both') && suiRewardAmount > 0) {
      await checkWalletBalance();
      setShowPaymentModal(true);
      return;
    }

    // Proceed with quiz creation
    await proceedWithQuizCreation();
  };

  const proceedWithQuizCreation = async () => {
    setIsCreating(true);
    try {
      // Create quiz data
      const quizData = {
        title,
        description,
        timePerQuestion,
        mediaId,
        questions: questions.map(q => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points,
          mediaId: q.mediaId,
        })),
        maxPlayers: 10, // Default max players
        rewardType,
        suiRewardAmount: rewardType === 'sui' || rewardType === 'both' ? suiRewardAmount : 0,
        rewardDistribution,
        manualPercentages: rewardDistribution === 'manual' ? manualPercentages : [50, 30, 20],
      };

      const hostAddress = getAddress() || '0x0000000000000000000000000000000000000000';

      // Send to backend to create room
      const response = await fetch('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizData,
          hostAddress: hostAddress,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Quiz created successfully
        let successMessage = `✅ Your quiz has been created and is ready to play!\nRoom Code: ${result.roomCode}\n🎯 Quiz data saved to Walrus storage`;
        successMessage += `\n🏆 Rewards will be distributed to winners automatically`;
        
        alert(successMessage);
        
        setSuccessData({ roomCode: result.roomCode });
        setShowSuccessModal(true);
        setTitle("");
        setDescription("");
        setTimePerQuestion(30);
        setMediaId("");
        setUploadedImage(null);
        setQuestions([]);
        setRewardType('certificate');
        setSuiRewardAmount(0);
        setRewardDistribution('top3');
        setManualPercentages([50, 30, 20]);
        setRefreshKey(refreshKey + 1);
      } else {
        const details = (result && (result.details || result.error)) ? `\nDetails: ${result.details || result.error}` : '';
        throw new Error((result.error || 'Failed to create quiz') + details);
      }
    } catch (error) {
      console.error("Error creating quiz:", error);
      let message = 'Failed to create quiz';
      
      if (error instanceof Error) {
        message = error.message;
        
        // Add more specific error messages
        if (error.message.includes('Failed to fetch')) {
          message = 'Cannot connect to server. Please check if the backend is running.';
        } else if (error.message.includes('HTTP 500')) {
          message = 'Server error occurred. Please try again.';
        } else if (error.message.includes('HTTP 400')) {
          message = 'Invalid quiz data. Please check your inputs.';
        } else if (error.message.includes('Insufficient balance')) {
          message = 'Insufficient SUI balance. Please add more SUI to your wallet.';
        } else if (error.message.includes('User rejected')) {
          message = 'Transaction was rejected. Please try again and approve the transaction.';
        }
      }
      
      alert(`❌ ${message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Box>
      <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
        🎯 Create New Quiz
      </Heading>

      <Flex direction="column" gap="4" style={{ maxWidth: "800px" }}>
        {/* Basic Quiz Info */}
        <Box>
          <Text size="3" style={{ color: "#dcdcdc", marginBottom: "8px", display: "block" }}>
            Quiz Title *
          </Text>
          <TextField.Root
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter quiz title..."
            style={{
              backgroundColor: "#4b4b4b",
              border: "1px solid #e37a1c",
              color: "#dcdcdc",
            }}
          />
        </Box>

        {/* Image Upload */}
        <Box>
          <Text size="3" style={{ color: "#dcdcdc", marginBottom: "8px", display: "block" }}>
            Quiz Cover Image (Optional)
          </Text>
          <Flex direction="column" gap="3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
              style={{
                padding: "12px",
                backgroundColor: "#4b4b4b",
                border: "1px solid #e37a1c",
                borderRadius: "8px",
                color: "#dcdcdc",
                cursor: isUploading ? "not-allowed" : "pointer",
              }}
            />
            {isUploading && (
              <Text size="2" style={{ color: "#e37a1c" }}>
                Uploading image to Walrus...
              </Text>
            )}
            {uploadedImage && (
              <Box>
                <Text size="2" style={{ color: "#4ade80", marginBottom: "8px", display: "block" }}>
                  Image uploaded successfully!
                </Text>
                <img
                  src={uploadedImage}
                  alt="Quiz cover"
                  style={{
                    maxWidth: "200px",
                    maxHeight: "150px",
                    borderRadius: "8px",
                    border: "1px solid #e37a1c",
                  }}
                />
              </Box>
            )}
          </Flex>
        </Box>

        <Box>
          <Text size="3" style={{ color: "#dcdcdc", marginBottom: "8px", display: "block" }}>
            Description *
          </Text>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your quiz..."
            style={{
              backgroundColor: "#4b4b4b",
              border: "1px solid #e37a1c",
              color: "#dcdcdc",
              minHeight: "100px",
            }}
          />
        </Box>

        <Flex gap="4">
          <Box style={{ flex: 1 }}>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "8px", display: "block" }}>
              Time per Question (seconds)
            </Text>
            <TextField.Root
              type="number"
              value={timePerQuestion}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setTimePerQuestion(0);
                } else {
                  const numValue = parseInt(value);
                  if (!isNaN(numValue)) {
                    setTimePerQuestion(numValue);
                  }
                }
              }}
              style={{
                backgroundColor: "#4b4b4b",
                border: "1px solid #e37a1c",
                color: "#dcdcdc",
              }}
            />
          </Box>

          <Box style={{ flex: 1 }}>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "8px", display: "block" }}>
              Media ID (Walrus)
            </Text>
            <TextField.Root
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
              placeholder="Optional media ID..."
              style={{
                backgroundColor: "#4b4b4b",
                border: "1px solid #e37a1c",
                color: "#dcdcdc",
              }}
            />
          </Box>
        </Flex>

        {/* Questions Section */}
        <Box>
          <Flex justify="between" align="center" style={{ marginBottom: "16px" }}>
            <Text size="4" style={{ color: "#dcdcdc", fontWeight: "600" }}>
              Questions ({questions.length})
            </Text>
            <Button
              onClick={addQuestion}
              style={{
                backgroundColor: "#e37a1c",
                color: "#4b4b4b",
                border: "none",
                cursor: "pointer",
              }}
            >
              + Add Question
            </Button>
          </Flex>

          {/* Points Mode Selection */}
          <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "16px", marginBottom: "16px" }}>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "12px", display: "block", fontWeight: "600" }}>
              Points Configuration
            </Text>
            <Flex gap="4" align="center" style={{ marginBottom: "12px" }}>
              <Text size="2" style={{ color: "#dcdcdc" }}>Mode:</Text>
              <select
                value={pointsMode}
                onChange={(e) => setPointsMode(e.target.value as 'auto' | 'manual')}
                style={{
                  backgroundColor: "#4b4b4b",
                  border: "1px solid #e37a1c",
                  color: "#dcdcdc",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              >
                <option value="auto">Auto (Same points for all questions)</option>
                <option value="manual">Manual (Set points per question)</option>
              </select>
            </Flex>
            
            {pointsMode === 'auto' && (
              <Flex gap="4" align="center">
                <Text size="2" style={{ color: "#dcdcdc" }}>Points per question:</Text>
                <TextField.Root
                  type="number"
                  value={autoPointsPerQuestion}
                  onChange={(e) => setAutoPointsPerQuestion(parseInt(e.target.value) || 10)}
                  style={{
                    backgroundColor: "#4b4b4b",
                    border: "1px solid #e37a1c",
                    color: "#dcdcdc",
                    width: "80px",
                  }}
                />
              </Flex>
            )}
            
            {pointsMode === 'manual' && (
              <Text size="2" style={{ color: "#dcdcdc", opacity: 0.8 }}>
                You can set individual points for each question below
              </Text>
            )}
          </Card>

          {/* Reward Type Selection */}
          <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "16px", marginBottom: "16px" }}>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "12px", display: "block", fontWeight: "600" }}>
              🏆 Reward Configuration
            </Text>
            <Flex direction="column" gap="3">
              <Flex gap="4" align="center">
                <Text size="2" style={{ color: "#dcdcdc" }}>Reward Type:</Text>
                <select
                  value={rewardType}
                  onChange={(e) => setRewardType(e.target.value as 'certificate' | 'sui' | 'both')}
                  style={{
                    backgroundColor: "#4b4b4b",
                    border: "1px solid #e37a1c",
                    color: "#dcdcdc",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                >
                  <option value="certificate">📜 Certificate Only</option>
                  <option value="sui">💰 SUI Tokens Only</option>
                  <option value="both">🎁 Both Certificate & SUI</option>
                </select>
              </Flex>
              
              {(rewardType === 'sui' || rewardType === 'both') && (
                <Flex gap="4" align="center">
                  <Text size="2" style={{ color: "#dcdcdc" }}>SUI Amount:</Text>
                  <TextField.Root
                    type="number"
                    value={suiRewardAmount}
                    onChange={(e) => setSuiRewardAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    step="0.1"
                    min="0"
                    style={{
                      backgroundColor: "#4b4b4b",
                      border: "1px solid #e37a1c",
                      color: "#dcdcdc",
                      width: "120px",
                    }}
                  />
                  <Text size="2" style={{ color: "#e37a1c" }}>SUI</Text>
                </Flex>
              )}
              
              <Text size="1" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                {rewardType === 'certificate' ? "🏆 Winners will receive achievement certificates" :
                 rewardType === 'sui' ? "💰 Winners will receive SUI tokens as rewards" :
                 "🎁 Winners will receive both certificates and SUI tokens"}
              </Text>
            </Flex>

            {/* Reward Distribution */}
            <Flex direction="column" gap="3" style={{ marginTop: "16px" }}>
              <Flex gap="4" align="center">
                <Text size="2" style={{ color: "#dcdcdc" }}>Distribution:</Text>
                <select
                  value={rewardDistribution}
                  onChange={(e) => setRewardDistribution(e.target.value as 'top3' | 'manual')}
                  style={{
                    backgroundColor: "#4b4b4b",
                    border: "1px solid #e37a1c",
                    color: "#dcdcdc",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                >
                  <option value="top3">🥇 Top 3 (50%, 30%, 20%)</option>
                  <option value="manual">⚙️ Manual Percentages</option>
                </select>
              </Flex>

              {rewardDistribution === 'manual' && (
                <Flex direction="column" gap="2">
                  <Text size="2" style={{ color: "#dcdcdc" }}>Manual Distribution:</Text>
                  {manualPercentages.map((percentage, index) => (
                    <Flex key={index} gap="2" align="center">
                      <Text size="2" style={{ color: "#dcdcdc", minWidth: "60px" }}>
                        Position {index + 1}:
                      </Text>
                      <TextField.Root
                        type="number"
                        value={percentage}
                        onChange={(e) => updateManualPercentage(index, parseInt(e.target.value) || 0)}
                        min="0"
                        max="100"
                        style={{
                          backgroundColor: "#4b4b4b",
                          border: "1px solid #e37a1c",
                          color: "#dcdcdc",
                          width: "80px",
                        }}
                      />
                      <Text size="2" style={{ color: "#e37a1c" }}>%</Text>
                      {manualPercentages.length > 1 && (
                        <Button
                          onClick={() => removePercentageSlot(index)}
                          style={{
                            backgroundColor: "transparent",
                            color: "#e37a1c",
                            border: "1px solid #e37a1c",
                            cursor: "pointer",
                            padding: "2px 6px",
                            fontSize: "12px",
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </Flex>
                  ))}
                  
                  <Flex gap="2" align="center" style={{ marginTop: "8px" }}>
                    <Button
                      onClick={addPercentageSlot}
                      style={{
                        backgroundColor: "transparent",
                        color: "#e37a1c",
                        border: "1px solid #e37a1c",
                        cursor: "pointer",
                        padding: "4px 8px",
                        fontSize: "12px",
                      }}
                    >
                      + Add Position
                    </Button>
                    <Text size="1" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                      Total: {manualPercentages.reduce((sum, p) => sum + p, 0)}%
                    </Text>
                  </Flex>
                </Flex>
              )}

              {rewardDistribution === 'top3' && (
                <Text size="1" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                  🥇 1st place: 50% | 🥈 2nd place: 30% | 🥉 3rd place: 20%
                </Text>
              )}
            </Flex>
          </Card>

          {questions.map((question, index) => (
            <Box
              key={question.id}
              style={{
                border: "1px solid #e37a1c",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
                backgroundColor: "#4b4b4b",
              }}
            >
              <Flex justify="between" align="center" style={{ marginBottom: "12px" }}>
                <Text size="3" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                  Question {index + 1}
                </Text>
                <Button
                  onClick={() => removeQuestion(index)}
                  style={{
                    backgroundColor: "transparent",
                    color: "#e37a1c",
                    border: "1px solid #e37a1c",
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  Remove
                </Button>
              </Flex>

              <Box style={{ marginBottom: "12px" }}>
                <Text size="2" style={{ color: "#dcdcdc", marginBottom: "4px", display: "block" }}>
                  Question Text *
                </Text>
                <TextField.Root
                  value={question.questionText}
                  onChange={(e) => updateQuestion(index, "questionText", e.target.value)}
                  placeholder="Enter your question..."
                  style={{
                    backgroundColor: "#4b4b4b",
                    border: "1px solid #e37a1c",
                    color: "#dcdcdc",
                  }}
                />
              </Box>

              <Box style={{ marginBottom: "12px" }}>
                <Text size="2" style={{ color: "#dcdcdc", marginBottom: "4px", display: "block" }}>
                  Options *
                </Text>
                {question.options.map((option, optionIndex) => (
                  <Box key={optionIndex} style={{ marginBottom: "8px" }}>
                    <Flex align="center" gap="2">
                      <Text size="2" style={{ color: "#dcdcdc", minWidth: "20px" }}>
                        {String.fromCharCode(65 + optionIndex)}:
                      </Text>
                      <TextField.Root
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...question.options];
                          newOptions[optionIndex] = e.target.value;
                          updateQuestion(index, "options", newOptions);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                        style={{
                          backgroundColor: "#4b4b4b",
                          border: "1px solid #e37a1c",
                          color: "#dcdcdc",
                          flex: 1,
                        }}
                      />
                    </Flex>
                  </Box>
                ))}
              </Box>

              <Flex gap="4">
                <Box style={{ flex: 1 }}>
                  <Text size="2" style={{ color: "#dcdcdc", marginBottom: "4px", display: "block" }}>
                    Correct Answer
                  </Text>
                  <select
                    value={question.correctAnswer}
                    onChange={(e) => updateQuestion(index, "correctAnswer", parseInt(e.target.value))}
                    style={{
                      backgroundColor: "#4b4b4b",
                      border: "1px solid #e37a1c",
                      color: "#dcdcdc",
                      padding: "8px",
                      borderRadius: "4px",
                      width: "100%",
                    }}
                  >
                    <option value={0}>A</option>
                    <option value={1}>B</option>
                    <option value={2}>C</option>
                    <option value={3}>D</option>
                  </select>
                </Box>

                {pointsMode === 'manual' && (
                  <Box style={{ flex: 1 }}>
                    <Text size="2" style={{ color: "#dcdcdc", marginBottom: "4px", display: "block" }}>
                      Points
                    </Text>
                    <TextField.Root
                      type="number"
                      value={question.points}
                      onChange={(e) => updateQuestion(index, "points", parseInt(e.target.value) || 10)}
                      style={{
                        backgroundColor: "#4b4b4b",
                        border: "1px solid #e37a1c",
                        color: "#dcdcdc",
                      }}
                    />
                  </Box>
                )}
                
                {pointsMode === 'auto' && (
                  <Box style={{ flex: 1 }}>
                    <Text size="2" style={{ color: "#dcdcdc", marginBottom: "4px", display: "block" }}>
                      Points
                    </Text>
                    <Text size="2" style={{ color: "#e37a1c", fontWeight: "600" }}>
                      {autoPointsPerQuestion} (Auto)
                    </Text>
                  </Box>
                )}
              </Flex>
            </Box>
          ))}
        </Box>

        {/* Create Button */}
        <Button
          onClick={createQuiz}
          disabled={isCreating || !title || !description || questions.length === 0 || 
                   ((rewardType === 'sui' || rewardType === 'both') && suiRewardAmount <= 0) ||
                   (rewardDistribution === 'manual' && manualPercentages.reduce((sum, p) => sum + p, 0) !== 100)}
          style={{
            backgroundColor: isCreating ? "#666" : "#e37a1c",
            color: "#4b4b4b",
            border: "none",
            cursor: isCreating ? "not-allowed" : "pointer",
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "8px",
            marginTop: "20px",
          }}
        >
          {isCreating ? "Creating Quiz..." : "🎯 Create Quiz"}
        </Button>
      </Flex>

      {/* Payment Confirmation Modal */}
      <SuccessModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="💰 Payment Confirmation"
        message={`You are about to create a quiz with ${suiRewardAmount} SUI rewards.`}
        details={
          <div style={{ textAlign: 'left', marginTop: '10px' }}>
            <p><strong>Reward Amount:</strong> {suiRewardAmount} SUI</p>
            <p><strong>Your Balance:</strong> {walletBalance.toFixed(4)} SUI</p>
            <p><strong>Distribution:</strong> {rewardDistribution === 'top3' ? 'Top 3 (50%, 30%, 20%)' : 'Manual'}</p>
            {walletBalance < suiRewardAmount && (
              <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                ⚠️ Insufficient balance! You need {suiRewardAmount - walletBalance} more SUI.
              </p>
            )}
          </div>
        }
        buttonText={walletBalance >= suiRewardAmount ? "Confirm & Create Quiz" : "Check Balance"}
        onButtonClick={() => {
          if (walletBalance >= suiRewardAmount) {
            setShowPaymentModal(false);
            proceedWithQuizCreation();
          } else {
            checkWalletBalance();
          }
        }}
        secondaryButtonText="Cancel"
        onSecondaryButtonClick={() => setShowPaymentModal(false)}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Quiz Created Successfully!"
        message="Your quiz has been created and is ready to play!"
        details={`Room Code: ${successData?.roomCode}\n\n🎯 Quiz data saved to Walrus storage\n🏆 Rewards will be distributed to winners automatically`}
        buttonText="Go to Lobby"
        onButtonClick={() => {
          setShowSuccessModal(false);
          if (onNavigateToLobby) {
            onNavigateToLobby();
          }
        }}
      />
    </Box>
  );
}
