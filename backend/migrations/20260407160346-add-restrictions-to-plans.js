'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plans', 'project_limit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('plans', 'contributor_limit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 2,
    });
    await queryInterface.addColumn('plans', 'client_limit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('plans', 'max_snags', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 15,
    });
    await queryInterface.addColumn('plans', 'max_rfis', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 15,
    });
    await queryInterface.addColumn('plans', 'can_export_reports', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('plans', 'can_share_media', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('plans', 'can_export_handover', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('plans', 'project_limit');
    await queryInterface.removeColumn('plans', 'contributor_limit');
    await queryInterface.removeColumn('plans', 'client_limit');
    await queryInterface.removeColumn('plans', 'max_snags');
    await queryInterface.removeColumn('plans', 'max_rfis');
    await queryInterface.removeColumn('plans', 'can_export_reports');
    await queryInterface.removeColumn('plans', 'can_share_media');
    await queryInterface.removeColumn('plans', 'can_export_handover');
  }
};
