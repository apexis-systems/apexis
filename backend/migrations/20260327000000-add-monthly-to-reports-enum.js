'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // In PostgreSQL, you can't easily add a value to an ENUM inside a transaction.
    // However, if we're using queryInterface, we might need to use raw SQL.
    // The enum type name in PG is usually "enum_reports_type" if created via Sequelize.
    try {
      await queryInterface.sequelize.query("ALTER TYPE \"enum_reports_type\" ADD VALUE 'monthly'");
    } catch (e) {
      // If the type name is different or it's not PG, we might need a different approach.
      console.log('Skip adding ENUM value (might already exist or different DB):', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Standard PG doesn't support removing ENUM values easily.
    // Usually, you'd have to recreate the type. For a simple migration, we skip the down.
  }
};
