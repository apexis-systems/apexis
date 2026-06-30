'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('file_flag_history', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      file_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'files',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      flag: {
        type: Sequelize.ENUM('do_not_follow', 'only_for_reference'),
        allowNull: false,
      },
      value: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      changed_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('file_flag_history', ['file_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('file_flag_history');
  },
};
