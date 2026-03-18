import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, FlatList, BackHandler } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect } from 'expo-router';
import { Project, User } from '@/types';

interface RFIItem {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed' | 'overdue';
  createdBy: string;
  createdById: string;
  assignedTo: string;
  assignedToId: string;
  createdDate: string;
  answeredDate?: string;
  expectedResponseDays: number;
  photos?: string[];
}

interface Props {
  project: Project;
  user: User;
}

const statusConfig = {
  open: { icon: 'alert-circle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Open' },
  closed: { icon: 'check-circle', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Closed' },
  overdue: { icon: 'alert-triangle', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Overdue' },
};

export default function ProjectRFI({ project, user }: Props) {
  const { colors } = useTheme();
  const [rfis] = useState<RFIItem[]>([
    {
      id: 'rfi-1',
      title: 'Clarification on foundation depth',
      description: 'Need clarification on the foundation depth for Block A as per revised structural drawings.',
      status: 'open',
      createdBy: 'Priya Sharma',
      createdById: 'u2',
      assignedTo: 'Rajesh Kumar',
      assignedToId: 'u1',
      createdDate: '2025-11-18',
      expectedResponseDays: 3,
    },
  ]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'overdue'>('all');

  const filteredRfis = rfis.filter(r => statusFilter === 'all' || r.status === statusFilter);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (statusFilter !== 'all') {
          setStatusFilter('all');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [statusFilter])
  );

  const renderRFI = ({ item }: { item: RFIItem }) => {
    const config = statusConfig[item.status];
    return (
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: config.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={config.icon as any} size={20} color={config.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>{item.title}</Text>
              <View style={{ backgroundColor: config.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: config.color }}>{config.label}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>{item.description}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{item.createdBy.charAt(0)}</Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>by {item.createdBy}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="user" size={10} color={colors.primary} />
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>{item.assignedTo}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Feather name="clock" size={10} color={colors.textMuted} />
              <Text style={{ fontSize: 10, color: colors.textMuted }}>{item.createdDate} · {item.expectedResponseDays}d expected</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <TouchableOpacity style={{
        backgroundColor: colors.primary,
        height: 44,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16
      }}>
        <Feather name="plus" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>New RFI</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {['all', 'open', 'overdue', 'closed'].map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f as any)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: statusFilter === f ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: statusFilter === f ? colors.primary : colors.border
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: statusFilter === f ? '#fff' : colors.textMuted }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredRfis}
        renderItem={renderRFI}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Feather name="message-square" size={48} color={colors.border} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>No RFIs found</Text>
          </View>
        }
      />
    </View>
  );
}
