'use strict';

export default  {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rfis', 'response_photos', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('snags', 'response_photos', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('rfis', 'response_photos');
    await queryInterface.removeColumn('snags', 'response_photos');
  }
};
