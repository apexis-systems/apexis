'use strict';

export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('chat_messages', 'file_url', {
            type: Sequelize.TEXT,
            allowNull: true,
        });
        await queryInterface.addColumn('chat_messages', 'file_name', {
            type: Sequelize.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn('chat_messages', 'file_type', {
            type: Sequelize.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn('chat_messages', 'file_size', {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('chat_messages', 'file_url');
        await queryInterface.removeColumn('chat_messages', 'file_name');
        await queryInterface.removeColumn('chat_messages', 'file_type');
        await queryInterface.removeColumn('chat_messages', 'file_size');
    }
};
