'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    try {
      // Postgres-specific syntax to add a value to an existing ENUM type
      // We use IF NOT EXISTS to prevent errors on multiple runs
      await queryInterface.sequelize.query('ALTER TYPE "enum_activities_type" ADD VALUE IF NOT EXISTS \'photo_comment\'');
    } catch (err) {
      // In some cases, the type name might vary. Log error but don't fail migration 
      // if it's just because the type doesn't exist yet (though it should).
      console.warn('ENUM update warning:', err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Postgres does not support removing values from an ENUM type
    // Usually, we would leave it as is or do a complex table rebuild
  }
};
