import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Report = sequelize.define(
        "reports",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            type: {
                type: DataTypes.ENUM("daily", "weekly", "monthly"),
                allowNull: false,
            },

            period_start: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            period_end: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            photos_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            docs_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            releases_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            comments_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            summary: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        },
        {
            tableName: "reports",
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ['project_id', 'type', 'period_start', 'period_end'],
                    name: 'reports_project_type_period_unique'
                }
            ]
        }
    );

    return Report;
};
