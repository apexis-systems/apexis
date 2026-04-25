'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('snags', 'last_comment', 'response');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('snags', 'response', 'last_comment');
  }
};
