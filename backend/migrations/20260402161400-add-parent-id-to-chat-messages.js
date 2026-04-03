'use strict';

export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('chat_messages', 'parent_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'chat_messages',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('chat_messages', 'parent_id');
    }
};
