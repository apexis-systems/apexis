import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const BlockedUser = sequelize.define(
        "blocked_users",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            organization_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            phone_number: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: "blocked_users",
            timestamps: true,
        }
    );

    return BlockedUser;
};
