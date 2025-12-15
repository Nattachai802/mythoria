import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Tailwind,
} from '@react-email/components';

interface PasswordResetEmailProps {
    userEmail: string;
    resetLink: string;
    expirationTime: string;
}

const PasswordResetEmail = (props: PasswordResetEmailProps) => {
  const { userEmail, resetLink, expirationTime } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-lg max-w-[600px] mx-auto p-[40px]">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Text className="text-[28px] font-bold text-gray-900 m-0">
                Reset Your Password
              </Text>
              <Text className="text-[16px] text-gray-600 mt-[8px] m-0">
                We received a request to reset your password
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="mb-[32px]">
              <Text className="text-[16px] text-gray-700 leading-[24px] mb-[16px]">
                Hello,
              </Text>
              <Text className="text-[16px] text-gray-700 leading-[24px] mb-[16px]">
                We received a password reset request for your account associated with <strong>{userEmail}</strong>. 
                If you made this request, click the button below to reset your password.
              </Text>
              <Text className="text-[16px] text-gray-700 leading-[24px] mb-[24px]">
                This link will expire in <strong>{expirationTime}</strong> for security reasons.
              </Text>

              {/* Reset Button */}
              <Section className="text-center mb-[24px]">
                <Button
                  href={resetLink}
                  className="bg-blue-600 text-white px-[32px] py-[12px] rounded-[6px] text-[16px] font-semibold no-underline box-border"
                >
                  Reset Password
                </Button>
              </Section>

              <Text className="text-[14px] text-gray-600 leading-[20px] mb-[16px]">
                If the button doesn't work, copy and paste this link into your browser:
              </Text>
              <Text className="text-[14px] text-blue-600 break-all mb-[24px]">
                {resetLink}
              </Text>
            </Section>

            <Hr className="border-gray-200 my-[24px]" />

            {/* Security Notice */}
            <Section className="mb-[24px]">
              <Text className="text-[16px] font-semibold text-gray-900 mb-[12px]">
                Security Notice
              </Text>
              <Text className="text-[14px] text-gray-700 leading-[20px] mb-[8px]">
                • If you didn't request this password reset, please ignore this email
              </Text>
              <Text className="text-[14px] text-gray-700 leading-[20px] mb-[8px]">
                • Never share your password or reset links with anyone
              </Text>
              <Text className="text-[14px] text-gray-700 leading-[20px] mb-[8px]">
                • This link can only be used once and will expire soon
              </Text>
            </Section>

            <Hr className="border-gray-200 my-[24px]" />

            {/* Footer */}
            <Section className="text-center">
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0">
                This email was sent to {userEmail}
              </Text>
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0">
                © 2025 Your Company Name. All rights reserved.
              </Text>
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0">
                123 Business Street, Bangkok, Thailand 10110
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

PasswordResetEmail.PreviewProps = {
  userEmail: "tsnarukami@gmail.com",
  resetLink: "https://yourapp.com/reset-password?token=abc123xyz789",
  expirationTime: "24 hours",
};

export default PasswordResetEmail;