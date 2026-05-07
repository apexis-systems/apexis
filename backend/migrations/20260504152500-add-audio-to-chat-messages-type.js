'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    // Alter the enum to add 'audio' as a valid message type
    // Note: IF NOT EXISTS is supported in PostgreSQL 9.3+
    try {
        await queryInterface.sequelize.query(`ALTER TYPE "enum_chat_messages_type" ADD VALUE IF NOT EXISTS 'audio';`);
    } catch (e) {
        console.error('Error adding audio to enum_chat_messages_type', e);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Postgres does not support removing values from an ENUM type easily.
    // We leave this empty as a one-way migration.
  }
};
