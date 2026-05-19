'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('snags', 'folder_ids', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('snags', 'folder_ids');
  }
};
