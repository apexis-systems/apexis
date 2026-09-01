import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const ArchivedProject = sequelize.define(
        "archived_projects",
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
            original_project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            contributor_code: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            client_code: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            start_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            end_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            archived_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            archived_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            zip_file_url: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            zip_file_size_bytes: {
                type: DataTypes.BIGINT,
                allowNull: true,
                defaultValue: 0,
            },
            stats_summary: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {},
            },
            snapshot_data: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {},
            },
            status: {
                type: DataTypes.ENUM("archiving", "archived", "restoring", "failed"),
                allowNull: false,
                defaultValue: "archiving",
            },
            error_message: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: "archived_projects",
            timestamps: true,
            paranoid: true,
        }
    );

    return ArchivedProject;
};
