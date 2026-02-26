import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Project = sequelize.define(
        "projects",
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
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            contributor_code: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            client_code: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: "projects",
            timestamps: true,
        }
    );

    return Project;
};
