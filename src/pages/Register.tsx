import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Steps } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const { Step } = Steps;

const Register: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await authService.register(values);
      setEmail(values.email);
      setPassword(values.password);
      setStep(1);
      message.success('验证码已发送到您的邮箱');
    } catch (error: any) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCode = async (values: any) => {
    setLoading(true);
    try {
      await authService.completeRegistration({
        email,
        password,
        code: values.code,
      });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      message.error(error.response?.data?.message || '验证失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto' }}>
      <Card title="用户注册">
        <Steps current={step} style={{ marginBottom: 24 }}>
          <Step title="填写信息" />
          <Step title="验证邮箱" />
        </Steps>

        {step === 0 ? (
          <Form
            form={form}
            name="register"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="邮箱"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能小于6位' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
              >
                注册
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form
            form={form}
            name="verify"
            onFinish={onVerifyCode}
            autoComplete="off"
          >
            <Form.Item
              name="code"
              rules={[{ required: true, message: '请输入验证码' }]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="验证码"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
              >
                验证
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default Register; 