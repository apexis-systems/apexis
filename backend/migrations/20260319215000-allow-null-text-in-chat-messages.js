'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn('chat_messages', 'text', {
            type: Sequelize.TEXT,
            allowNull: true,
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn('chat_messages', 'text', {
            type: Sequelize.TEXT,
            allowNull: false,
        });
    }
};
