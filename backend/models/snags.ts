import { DataTypes, Model } from 'sequelize';

export default (sequelize: any, dataTypes: typeof DataTypes) => {
    class snags extends Model { }
    snags.init({
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        project_id: { type: dataTypes.INTEGER, allowNull: false },
        title: { type: dataTypes.STRING(200), allowNull: false },
        description: { type: dataTypes.TEXT },
        photo_url: { type: dataTypes.TEXT },
        assigned_to: { type: dataTypes.INTEGER },
        status: { type: dataTypes.STRING(10), defaultValue: 'amber' },
        last_comment: { type: dataTypes.TEXT },
        created_by: { type: dataTypes.INTEGER },
    }, {
        sequelize,
        modelName: 'snags',
        tableName: 'snags',
    });
    return snags;
};
