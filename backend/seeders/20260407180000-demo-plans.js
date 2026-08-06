'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    const newPlansData = [
      {
        name: 'Freemium',
        price: 0,
        price_per_seat_monthly: 159,
        price_per_seat_annually: 99,
        storage_limit_mb: 2048,
        duration_days: 45,
        project_limit: 10,
        contributor_limit: 50,
        client_limit: 999,
        max_snags: 9999,
        max_rfis: 9999,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: true,
      },
      {
        name: 'Starter',
        price: 159,
        price_per_seat_monthly: 159,
        price_per_seat_annually: 99,
        storage_limit_mb: 5120,
        duration_days: 30,
        project_limit: 999999,
        contributor_limit: 100,
        client_limit: 999,
        max_snags: 9999,
        max_rfis: 9999,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: true,
      },
      {
        name: 'Enterprise',
        price: 999999,
        price_per_seat_monthly: 0,
        price_per_seat_annually: 0,
        storage_limit_mb: 1000000,
        duration_days: 365,
        project_limit: 999999,
        contributor_limit: 9999,
        client_limit: 9999,
        max_snags: 9999,
        max_rfis: 9999,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: true,
      }
    ];

    for (const plan of newPlansData) {
      const now = new Date();

      // Check if plan exists by name
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM plans WHERE name = ? LIMIT 1`,
        { replacements: [plan.name] }
      );

      if (existing.length > 0) {
        // Update existing plan
        await queryInterface.bulkUpdate('plans', { ...plan, updated_at: now }, { id: existing[0].id });
      } else {
        // Insert new plan
        await queryInterface.bulkInsert('plans', [{ ...plan, created_at: now, updated_at: now }]);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Only remove the plans we seeded by name to avoid clearing legitimate production data
    const planNames = ['Freemium', 'Starter', 'Enterprise'];
    await queryInterface.bulkDelete('plans', { name: planNames }, {});
  }
};
