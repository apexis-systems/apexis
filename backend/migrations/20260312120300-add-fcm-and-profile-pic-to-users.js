'use strict';

export default {
    up: async (queryInterface, Sequelize) => {
        // Add fcm_token if it doesn't exist (it shouldn't in migrations yet)
        await queryInterface.addColumn('users', 'fcm_token', {
            type: Sequelize.STRING,
            allowNull: true
        });

        // Add profile_pic
        await queryInterface.addColumn('users', 'profile_pic', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('users', 'fcm_token');
        await queryInterface.removeColumn('users', 'profile_pic');
    }
};
