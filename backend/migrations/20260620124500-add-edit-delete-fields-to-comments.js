'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('comments', 'is_deleted', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('comments', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('comments', 'is_edited', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('comments', 'edited_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('comments', 'edit_history', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('comments', 'is_deleted');
    } catch (e) {
      console.warn("Failed to remove is_deleted:", e.message);
    }
    try {
      await queryInterface.removeColumn('comments', 'deleted_at');
    } catch (e) {
      console.warn("Failed to remove deleted_at:", e.message);
    }
    try {
      await queryInterface.removeColumn('comments', 'is_edited');
    } catch (e) {
      console.warn("Failed to remove is_edited:", e.message);
    }
    try {
      await queryInterface.removeColumn('comments', 'edited_at');
    } catch (e) {
      console.warn("Failed to remove edited_at:", e.message);
    }
    try {
      await queryInterface.removeColumn('comments', 'previous_text');
    } catch (e) {
      console.warn("Failed to remove previous_text:", e.message);
    }
    try {
      await queryInterface.removeColumn('comments', 'edit_history');
    } catch (e) {
      console.warn("Failed to remove edit_history:", e.message);
    }
  }
};
