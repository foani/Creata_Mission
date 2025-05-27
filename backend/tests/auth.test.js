 // backend/tests/auth.test.js
 // Creata Wallet 인증 API 테스트
 
 const request = require('supertest');
 const express = require('express');
 const jwt = require('jsonwebtoken');
 const { ethers } = require('ethers');
 
 // Mock Prisma Client
 const mockPrisma = {
   user: {
     findUnique: jest.fn(),
     create: jest.fn(),
     update: jest.fn(),
   },
   $disconnect: jest.fn(),
 };
 
 // Prisma 모듈 모킹
 jest.mock('@prisma/client', () => ({
   PrismaClient: jest.fn(() => mockPrisma),
 }));
 
 // 테스트용 Express 앱 설정
 const app = express();
 app.use(express.json());
 
 // 환경변수 설정
 process.env.JWT_SECRET = 'test-secret-key';
 process.env.JWT_EXPIRES_IN = '7d';
 
 // 인증 라우터 불러오기
 const authRouter = require('../src/routes/auth');
 app.use('/auth', authRouter);
 
 describe('Auth API Tests', () => {
   // 테스트용 지갑 생성
   let testWallet;
   let testMessage;
   let testSignature;
   
   beforeAll(async () => {
     // 하드코딩된 프라이빗 키로 테스트 지갑 생성
     testWallet = new ethers.Wallet('0x1234567890123456789012345678901234567890123456789012345678901234');
     
     // 테스트용 메시지 생성
     const timestamp = Date.now();
     testMessage = `Creata 인증 요청 @ ${timestamp} by ${testWallet.address}`;
     
     // 메시지 서명
     testSignature = await testWallet.signMessage(testMessage);
   });
 
   beforeEach(() => {
     // 각 테스트 전에 mock 초기화
     jest.clearAllMocks();
   });
 
   afterAll(async () => {
     // 테스트 종료 후 정리
     await mockPrisma.$disconnect();
   });
 
   describe('POST /auth/verify-wallet', () => {
     const validRequestData = () => ({
       walletAddress: testWallet.address,
       message: testMessage,
       signature: testSignature,
       telegramId: '123456789'
     });
 
     describe('성공 케이스', () => {
       test('새 사용자 지갑 인증 성공', async () => {
         // Mock: 사용자가 존재하지 않음
         mockPrisma.user.findUnique.mockResolvedValue(null);
         
         // Mock: 새 사용자 생성
         const newUser = {
           id: 'user-1',
           walletAddress: testWallet.address.toLowerCase(),
           telegramId: '123456789',
           isWalletVerified: true,
           verifiedAt: new Date(),
           lastLoginAt: new Date(),
           createdAt: new Date()
         };
         mockPrisma.user.create.mockResolvedValue(newUser);
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(validRequestData());
 
         expect(response.status).toBe(200);
         expect(response.body.success).toBe(true);
         expect(response.body.message).toBe('지갑 인증이 완료되었습니다.');
         expect(response.body.data.token).toBeDefined();
         expect(response.body.data.user.walletAddress).toBe(testWallet.address.toLowerCase());
 
         // JWT 토큰 검증
         const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET);
         expect(decoded.userId).toBe('user-1');
         expect(decoded.walletAddress).toBe(testWallet.address.toLowerCase());
       });
 
       test('기존 사용자 지갑 인증 성공', async () => {
         const existingUser = {
           id: 'user-2',
           walletAddress: testWallet.address.toLowerCase(),
           telegramId: '123456789',
           isWalletVerified: true,
           score: 100,
           createdAt: new Date('2024-01-01'),
           lastLoginAt: new Date()
         };
 
         // Mock: 기존 사용자 찾기
         mockPrisma.user.findUnique.mockResolvedValue(existingUser);
         mockPrisma.user.update.mockResolvedValue({
           ...existingUser,
           lastLoginAt: new Date()
         });
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(validRequestData());
 
         expect(response.status).toBe(200);
         expect(response.body.success).toBe(true);
         expect(mockPrisma.user.update).toHaveBeenCalledWith({
           where: { id: 'user-2' },
           data: expect.objectContaining({
             isWalletVerified: true,
             telegramId: '123456789'
           })
         });
       });
     });
 
     describe('실패 케이스', () => {
       test('필수 필드 누락 - 지갑 주소', async () => {
         const invalidData = validRequestData();
         delete invalidData.walletAddress;
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(400);
         expect(response.body.success).toBe(false);
         expect(response.body.error).toBe('MISSING_REQUIRED_FIELDS');
       });
 
       test('필수 필드 누락 - 메시지', async () => {
         const invalidData = validRequestData();
         delete invalidData.message;
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(400);
         expect(response.body.error).toBe('MISSING_REQUIRED_FIELDS');
       });
 
       test('필수 필드 누락 - 서명', async () => {
         const invalidData = validRequestData();
         delete invalidData.signature;
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(400);
         expect(response.body.error).toBe('MISSING_REQUIRED_FIELDS');
       });
 
       test('잘못된 지갑 주소 형식', async () => {
         const invalidData = validRequestData();
         invalidData.walletAddress = 'invalid-address';
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(400);
         expect(response.body.error).toBe('INVALID_WALLET_ADDRESS');
       });
 
       test('잘못된 서명', async () => {
         const invalidData = validRequestData();
         invalidData.signature = '0xinvalid-signature';
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(400);
         expect(response.body.error).toBe('SIGNATURE_VERIFICATION_FAILED');
       });
 
       test('주소 불일치 - 다른 지갑으로 서명', async () => {
         // 다른 지갑으로 메시지 서명
         const anotherWallet = ethers.Wallet.createRandom();
         const wrongSignature = await anotherWallet.signMessage(testMessage);
 
         const invalidData = validRequestData();
         invalidData.signature = wrongSignature;
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(401);
         expect(response.body.error).toBe('ADDRESS_MISMATCH');
       });
 
       test('잘못된 메시지 형식', async () => {
         const wrongMessage = 'Invalid message format';
         const wrongSignature = await testWallet.signMessage(wrongMessage);
 
         const invalidData = validRequestData();
         invalidData.message = wrongMessage;
         invalidData.signature = wrongSignature;
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(400);
         expect(response.body.error).toBe('INVALID_MESSAGE_FORMAT');
       });
 
       test('만료된 메시지 (5분 이상 오래됨)', async () => {
         // 10분 전 타임스탬프로 메시지 생성
         const oldTimestamp = Date.now() - (10 * 60 * 1000);
         const expiredMessage = `Creata 인증 요청 @ ${oldTimestamp} by ${testWallet.address}`;
         const expiredSignature = await testWallet.signMessage(expiredMessage);
 
         const invalidData = validRequestData();
         invalidData.message = expiredMessage;
         invalidData.signature = expiredSignature;
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(invalidData);
 
         expect(response.status).toBe(401);
         expect(response.body.error).toBe('MESSAGE_EXPIRED');
       });
 
       test('데이터베이스 오류', async () => {
         mockPrisma.user.findUnique.mockRejectedValue(new Error('DB connection failed'));
 
         const response = await request(app)
           .post('/auth/verify-wallet')
           .send(validRequestData());
 
         expect(response.status).toBe(500);
         expect(response.body.error).toBe('DATABASE_ERROR');
       });
     });
   });
 
   describe('POST /auth/install-confirm', () => {
     const validInstallData = {
       walletAddress: testWallet.address,
       telegramId: '123456789'
     };
 
     test('성공 - 설치 확인', async () => {
       const updatedUser = {
         walletAddress: testWallet.address.toLowerCase(),
         isWalletInstalled: true,
         telegramId: '123456789'
       };
 
       mockPrisma.user.update.mockResolvedValue(updatedUser);
 
       const response = await request(app)
         .post('/auth/install-confirm')
         .send(validInstallData);
 
       expect(response.status).toBe(200);
       expect(response.body.success).toBe(true);
       expect(response.body.data.isWalletInstalled).toBe(true);
     });
 
     test('실패 - 사용자 찾을 수 없음', async () => {
       mockPrisma.user.update.mockRejectedValue({ code: 'P2025' });
 
       const response = await request(app)
         .post('/auth/install-confirm')
         .send(validInstallData);
 
       expect(response.status).toBe(404);
       expect(response.body.error).toBe('USER_NOT_FOUND');
     });
 
     test('실패 - 필수 필드 누락', async () => {
       const response = await request(app)
         .post('/auth/install-confirm')
         .send({ walletAddress: testWallet.address }); // telegramId 누락
 
       expect(response.status).toBe(400);
       expect(response.body.error).toBe('MISSING_REQUIRED_FIELDS');
     });
   });
 
   describe('GET /auth/me', () => {
     let validToken;
 
     beforeEach(() => {
       // 유효한 JWT 토큰 생성
       validToken = jwt.sign(
         {
           userId: 'user-1',
           walletAddress: testWallet.address.toLowerCase(),
           telegramId: '123456789'
         },
         process.env.JWT_SECRET,
         { expiresIn: '1h' }
       );
     });
 
     test('성공 - 사용자 정보 조회', async () => {
       const userData = {
         id: 'user-1',
         walletAddress: testWallet.address.toLowerCase(),
         telegramId: '123456789',
         isWalletVerified: true,
         isWalletInstalled: true,
         score: 100,
         language: 'ko',
         createdAt: new Date(),
         lastLoginAt: new Date()
       };
 
       mockPrisma.user.findUnique.mockResolvedValue(userData);
 
       const response = await request(app)
         .get('/auth/me')
         .set('Authorization', `Bearer ${validToken}`);
 
       expect(response.status).toBe(200);
       expect(response.body.success).toBe(true);
       expect(response.body.data.user.walletAddress).toBe(testWallet.address.toLowerCase());
     });
 
     test('실패 - 토큰 누락', async () => {
       const response = await request(app)
         .get('/auth/me');
 
       expect(response.status).toBe(401);
       expect(response.body.error).toBe('TOKEN_MISSING');
     });
 
     test('실패 - 잘못된 토큰', async () => {
       const response = await request(app)
         .get('/auth/me')
         .set('Authorization', 'Bearer invalid-token');
 
       expect(response.status).toBe(401);
       expect(response.body.error).toBe('TOKEN_INVALID');
     });
 
     test('실패 - 사용자 찾을 수 없음', async () => {
       mockPrisma.user.findUnique.mockResolvedValue(null);
 
       const response = await request(app)
         .get('/auth/me')
         .set('Authorization', `Bearer ${validToken}`);
 
       expect(response.status).toBe(404);
       expect(response.body.error).toBe('USER_NOT_FOUND');
     });
   });
 
   describe('서명 검증 유틸리티 테스트', () => {
     test('ethers.verifyMessage 정확성 검증', async () => {
       const message = 'Test message for signature verification';
       const signature = await testWallet.signMessage(message);
       
       const recoveredAddress = ethers.verifyMessage(message, signature);
       
       expect(recoveredAddress.toLowerCase()).toBe(testWallet.address.toLowerCase());
     });
 
     test('다른 메시지로 서명 검증 실패', async () => {
       const originalMessage = 'Original message';
       const signature = await testWallet.signMessage(originalMessage);
       
       const tamperedMessage = 'Tampered message';
       const recoveredAddress = ethers.verifyMessage(tamperedMessage, signature);
       
       expect(recoveredAddress.toLowerCase()).not.toBe(testWallet.address.toLowerCase());
     });
   });
 
   describe('JWT 토큰 검증 테스트', () => {
     test('유효한 토큰 검증', () => {
       const payload = {
         userId: 'user-1',
         walletAddress: testWallet.address
       };
 
       const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
 
       expect(decoded.userId).toBe('user-1');
       expect(decoded.walletAddress).toBe(testWallet.address);
     });
 
     test('만료된 토큰 검증 실패', () => {
       const payload = { userId: 'user-1' };
       const expiredToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1h' });
 
       expect(() => {
         jwt.verify(expiredToken, process.env.JWT_SECRET);
       }).toThrow();
     });
 
     test('잘못된 시크릿으로 토큰 검증 실패', () => {
       const payload = { userId: 'user-1' };
       const token = jwt.sign(payload, 'wrong-secret');
 
       expect(() => {
         jwt.verify(token, process.env.JWT_SECRET);
       }).toThrow();
     });
   });
 });
