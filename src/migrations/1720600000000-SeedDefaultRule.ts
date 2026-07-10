import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultRule1720600000000 implements MigrationInterface {
  name = 'SeedDefaultRule1720600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO rules (org_id, template, config, active)
      VALUES (
        '11111111-1111-4111-a111-111111111111',
        'home_security',
        '{"conditions": {"detected_type": "person"}, "action": "critical_alert"}'::jsonb,
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM rules WHERE org_id = '11111111-1111-4111-a111-111111111111' AND template = 'home_security'
    `);
  }
}
