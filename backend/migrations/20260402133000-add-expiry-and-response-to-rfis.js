'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rfis', 'expiry_date', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('rfis', 'response', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rfis', 'expiry_date');
    await queryInterface.removeColumn('rfis', 'response');
  }
};
