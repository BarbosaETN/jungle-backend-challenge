import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject protected route without token', async () => {
    await request(app.getHttpServer())
      .get('/protected')
      .expect(401);
  });

  it('should generate a JWT token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ userId: 'player-123' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('should allow access with a valid JWT', async () => {
    const tokenResponse = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ userId: 'player-123' })
      .expect(201);

    const token = tokenResponse.body.accessToken;

    const response = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      message: 'Authenticated successfully',
      userId: 'player-123',
    });
  });

  it('should reject an invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
});