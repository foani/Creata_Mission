/**
 * 관리자 계정 생성 스크립트
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface AdminData {
  walletAddress: string;
  email: string;
  password: string;
  role?: 'admin' | 'editor' | 'viewer';
}

async function createAdminAccount(data: AdminData) {
  try {
    console.log(`관리자 계정 생성 시작: ${data.email}`);

    // 1. 지갑 주소 검증
    if (!data.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('유효하지 않은 지갑 주소 형식입니다');
    }

    // 2. 기존 사용자 확인
    let user = await prisma.user.findUnique({
      where: { walletAddress: data.walletAddress }
    });

    // 3. User 계정이 없으면 생성
    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: data.walletAddress,
          isWalletVerified: true,
          isWalletInstalled: true,
          language: 'ko',
          score: 0
        }
      });
      console.log(`새 User 계정 생성됨: ${user.id}`);
    } else {
      console.log(`기존 User 계정 발견: ${user.id}`);
    }

    // 4. 기존 AdminUser 확인
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: data.email }
    });

    if (existingAdmin) {
      console.log(`이미 존재하는 관리자 이메일: ${data.email}`);
      return existingAdmin;
    }

    // 5. AdminUser와 User 연결 확인
    const existingUserAdmin = await prisma.adminUser.findUnique({
      where: { userId: user.id }
    });

    if (existingUserAdmin) {
      console.log(`해당 User는 이미 관리자 권한이 있습니다: ${existingUserAdmin.email}`);
      return existingUserAdmin;
    }

    // 6. 비밀번호 해싱
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // 7. AdminUser 계정 생성
    const adminUser = await prisma.adminUser.create({
      data: {
        userId: user.id,
        email: data.email,
        passwordHash: passwordHash,
        role: data.role || 'admin'
      },
      include: {
        user: true
      }
    });

    console.log(`관리자 계정 생성 완료: ${adminUser.email} (${adminUser.role})`);
    return adminUser;

  } catch (error) {
    console.error(`관리자 계정 생성 실패: ${data.email}`, error);
    throw error;
  }
  }

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    console.log('🚀 관리자 계정 생성 스크립트 시작\n');

    // 기본 관리자 계정 데이터
    const adminAccounts: AdminData[] = [
      {
        walletAddress: '0x742d35Cc688C10dD6A2d02B9aB6A0D42b9Bb5B23', // 하드코딩된 테스트 지갑 주소
        email: 'admin@creatachain.com',
        password: 'admin123!@#',
        role: 'admin'
      },
      {
        walletAddress: '0x8C9e4C7c8D7b6A5e4F3c2B1d0E9f8a7b6c5d4e3f', // 하드코딩된 테스트 지갑 주소 2
        email: 'editor@creatachain.com', 
        password: 'editor123!@#',
        role: 'editor'
      }
    ];

    // 관리자 계정들 생성
    for (const adminData of adminAccounts) {
      try {
        const result = await createAdminAccount(adminData);
        console.log(`✅ 관리자 계정 생성 성공: ${result.email} (${result.role})`);
      } catch (error) {
        console.error(`❌ 관리자 계정 생성 실패: ${adminData.email}`);
      }
    }

    // 생성된 관리자 목록 조회
    console.log('\n📋 생성된 관리자 계정 목록:');
    const allAdmins = await prisma.adminUser.findMany({
      include: {
        user: {
          select: {
            walletAddress: true,
            isWalletVerified: true
          }
        }
      }
    });

    allAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. 이메일: ${admin.email}`);
      console.log(`   역할: ${admin.role}`);
      console.log(`   지갑: ${admin.user.walletAddress}`);
      console.log(`   생성일: ${admin.createdAt.toISOString()}`);
      console.log('');
    });

    console.log('🎉 관리자 계정 생성 스크립트 완료!');

  } catch (error) {
    console.error('💥 스크립트 실행 실패:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 직접 실행
main().catch((error) => {
  console.error('스크립트 실행 중 예외 발생:', error);
  process.exit(1);
});