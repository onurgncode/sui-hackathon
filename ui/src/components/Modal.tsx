import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export function Modal({ isOpen, onClose, title, children, showCloseButton = true }: ModalProps) {
  if (!isOpen) return null;

  return (
    <Box
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <Box
        style={{
          backgroundColor: "#4b4b4b",
          border: "2px solid #e37a1c",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Flex justify="between" align="center" style={{ marginBottom: "20px" }}>
          <Heading size="4" style={{ color: "#dcdcdc" }}>
            {title}
          </Heading>
          {showCloseButton && (
            <Button
              onClick={onClose}
              style={{
                backgroundColor: "transparent",
                color: "#dcdcdc",
                border: "1px solid #dcdcdc",
                cursor: "pointer",
                padding: "4px 8px",
                fontSize: "12px",
                borderRadius: "4px",
              }}
            >
              ✕
            </Button>
          )}
        </Flex>
        {children}
      </Box>
    </Box>
  );
}

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

export function SuccessModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  details, 
  buttonText = "OK", 
  onButtonClick 
}: SuccessModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <Flex direction="column" gap="4">
        <Box
          style={{
            backgroundColor: "#4ade80",
            color: "#1f2937",
            padding: "16px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <Text size="4" style={{ fontWeight: "600", display: "block", marginBottom: "8px" }}>
            ✅ {message}
          </Text>
          {details && (
            <Text size="2" style={{ opacity: 0.8 }}>
              {details}
            </Text>
          )}
        </Box>
        
        <Flex justify="end" gap="2">
          <Button
            onClick={onButtonClick || onClose}
            style={{
              backgroundColor: "#e37a1c",
              color: "#4b4b4b",
              border: "none",
              cursor: "pointer",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "600",
              borderRadius: "6px",
            }}
          >
            {buttonText}
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}
