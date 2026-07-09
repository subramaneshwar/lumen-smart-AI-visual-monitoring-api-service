import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720400000000 implements MigrationInterface {
  name = 'InitSchema1720400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        plan TEXT DEFAULT 'personal',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        role TEXT DEFAULT 'owner',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE cameras (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        name TEXT NOT NULL,
        zone TEXT,
        stream_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE persons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        label TEXT,
        face_embedding VECTOR(128),
        first_seen TIMESTAMPTZ,
        last_seen TIMESTAMPTZ,
        visit_count INT DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        camera_id UUID REFERENCES cameras(id),
        person_id UUID REFERENCES persons(id) NULL,
        event_type TEXT NOT NULL,
        confidence FLOAT,
        zone TEXT,
        track_id TEXT,
        duration_seconds INT,
        clip_path TEXT,
        description TEXT,
        description_embedding VECTOR(384),
        action_taken TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        template TEXT,
        config JSONB NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        period TEXT,
        date DATE,
        content TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE chat_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        user_id UUID REFERENCES users(id),
        query TEXT,
        answer TEXT,
        referenced_event_ids UUID[],
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE notifications_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        event_id UUID REFERENCES events(id),
        channel TEXT,
        status TEXT,
        sent_at TIMESTAMPTZ DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS summaries`);
    await queryRunner.query(`DROP TABLE IF EXISTS rules`);
    await queryRunner.query(`DROP TABLE IF EXISTS events`);
    await queryRunner.query(`DROP TABLE IF EXISTS persons`);
    await queryRunner.query(`DROP TABLE IF EXISTS cameras`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations`);
  }
}
