import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedPrimaryCamera1720500000000 implements MigrationInterface {
  name = 'SeedPrimaryCamera1720500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO organizations (id, name, plan)
      VALUES ('11111111-1111-4111-a111-111111111111', 'Personal', 'personal')
    `);
    await queryRunner.query(`
      INSERT INTO cameras (id, org_id, name)
      VALUES ('22222222-2222-4222-a222-222222222222', '11111111-1111-4111-a111-111111111111', 'Primary Camera')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM cameras WHERE id = '22222222-2222-4222-a222-222222222222'`,
    );
    await queryRunner.query(
      `DELETE FROM organizations WHERE id = '11111111-1111-4111-a111-111111111111'`,
    );
  }
}
