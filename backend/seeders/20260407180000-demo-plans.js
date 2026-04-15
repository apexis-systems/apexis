'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    const newPlansData = [
      {
        name: 'Freemium',
        price: 0,
        storage_limit_mb: 2000,
        duration_days: 60,
        project_limit: 10,
        contributor_limit: 50,
        client_limit: 25,
        max_snags: 100,
        max_rfis: 200,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: false,
      },
      {
        name: 'One-Time Buy',
        price: 10000,
        storage_limit_mb: 5000,
        duration_days: 90,
        project_limit: 1,
        contributor_limit: 10,
        client_limit: 5,
        max_snags: 100,
        max_rfis: 100,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: true,
      },
      {
        name: 'Starter',
        price: 40000,
        storage_limit_mb: 25000,
        duration_days: 30,
        project_limit: 5,
        contributor_limit: 25,
        client_limit: 10,
        max_snags: 500,
        max_rfis: 500,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: true,
      },
      {
        name: 'Professional',
        price: 60000,
        storage_limit_mb: 100000,
        duration_days: 30,
        project_limit: 10,
        contributor_limit: 50,
        client_limit: 25,
        max_snags: 1000,
        max_rfis: 1000,
        can_export_reports: true,
        can_share_media: true,
        can_export_handover: true,
      },
      {
        name: 'Enterprise',
        price: 999999,
        storage_limit_mb: 1000000,
        duration_days: 365,
        project_limit: 999,
        contributor_limit: 999,
        client_limit: 999,
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
    const planNames = ['Freemium', 'One-Time Buy', 'Starter', 'Professional', 'Enterprise'];
    await queryInterface.bulkDelete('plans', { name: planNames }, {});
  }
};
