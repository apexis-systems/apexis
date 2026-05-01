'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rfis', 'folder_ids', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('rfis', 'folder_ids');
  }
};
