'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rfis', 'seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('snags', 'seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rfis', 'seen_at');
    await queryInterface.removeColumn('snags', 'seen_at');
  }
};
