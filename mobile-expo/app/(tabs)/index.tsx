import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Platform, Image, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import HelpSupportModal from '@/components/shared/HelpSupportModal';
import FeedbackModal from '@/components/shared/FeedbackModal';
import LanguageSelectorModal from '@/components/shared/LanguageSelectorModal';
import { useTranslation } from 'react-i18next';
import { setActiveProjectContext } from '@/utils/projectSelection';
import * as ImagePicker from 'expo-image-picker';
import { uploadOrganizationLogo, fetchSecureLogo, getOrganizations } from '@/services/organizationService';
import LogoPreviewModal from '@/components/shared/LogoPreviewModal';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();


  const [projects, setProjects] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', start_date: '', end_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const [localLogoKey, setLocalLogoKey] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);


  useEffect(() => {
    if (user) {
      if (user.role === 'superadmin') {
        fetchOrganizations();
      }
      fetchProjects(selectedOrgId);
      // Handle setting initial logo
      const orgs = (user as any).organizations || (user as any).organization;
      if (orgs?.logo) {
        setLocalLogoKey(orgs.logo);
      }
    }
  }, [user, selectedOrgId]);

  useEffect(() => {
    const fetchLogo = async () => {
      if (localLogoKey) {
        const uri = await fetchSecureLogo(localLogoKey);
        if (uri) {
          setLogoUri(uri);
        }
      }
    };
    fetchLogo();
  }, [localLogoKey]);

  useFocusEffect(
    useCallback(() => {
      // Clear out the active project scope if they return to Dashboard
      setActiveProjectContext(null, null);
    }, [])
  );

  if (!user) return null;

  const fetchOrganizations = async () => {
    try {
      const orgs = await getOrganizations();
      setOrganizations(orgs || []);
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  };

  const fetchProjects = async (orgId?: string | null) => {
    try {
      const url = orgId ? `/projects?organization_id=${orgId}` : '/projects';
      const res = await PrivateAxios.get(url);
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDocs = filteredProjects.reduce((sum, p) => sum + (parseInt(p.totalDocs, 10) || 0), 0);
  const totalPhotos = filteredProjects.reduce((sum, p) => sum + (parseInt(p.totalPhotos, 10) || 0), 0);

  const handleCreate = async () => {
    if (!newProject.name || !newProject.start_date || !newProject.end_date) return;
    setIsSubmitting(true);
    try {
      await PrivateAxios.post('/projects', newProject);
      setIsCreating(false);
      setNewProject({ name: '', description: '', start_date: '', end_date: '' });
      fetchProjects();
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoUpload = async () => {
    if (user?.role !== 'admin') return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      setIsUploadingLogo(true);
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('logo', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'logo.jpg',
      } as any);

      const res = await uploadOrganizationLogo(formData);

      setLocalLogoKey(res.logo);
    } catch (e: any) {
      console.error("Logo upload error:", e);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const roleSubtitle =
    user.role === 'superadmin'
      ? 'Super Admin'
      : user.role === 'admin'
        ? t('dashboard.roles.admin')
        : user.role === 'contributor'
          ? t('dashboard.roles.contributor')
          : t('dashboard.roles.client');

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Top Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            minHeight: 52,
          }}
        >
          {!isSearchActive ? (
            <>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: '#f97316',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>A</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Apexis</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setIsSearchActive(true)} style={{ padding: 6, borderRadius: 20 }}>
                  <Feather name="search" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleTheme} style={{ padding: 6, borderRadius: 20 }}>
                  <Feather name={isDark ? "sun" : "moon"} size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowHelp(true)} style={{ padding: 6, borderRadius: 20 }}>
                  <Feather name="help-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowFeedback(true)} style={{ padding: 6, borderRadius: 20 }}>
                  <Feather name="message-square" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowLanguage(true)} style={{ padding: 6, borderRadius: 20 }}>
                  <Feather name="globe" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/notifications')} style={{ padding: 6, borderRadius: 20, position: 'relative' }}>
                  <Feather name="bell" size={18} color={colors.textMuted} />
                  <View style={{ position: 'absolute', right: 6, top: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                </TouchableOpacity>


              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, height: 36, borderWidth: 1, borderColor: colors.border }}>
                <Feather name="search" size={16} color={colors.textMuted} />
                <TextInput
                  autoFocus
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search projects by name..."
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, color: colors.text, marginLeft: 8, fontSize: 14 }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Feather name="x-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => { setIsSearchActive(false); setSearchQuery(''); }}>
                <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
          {/* Left Side: Org Logo & Greeting */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <TouchableOpacity
              style={{ position: 'relative' }}
              onPress={() => setIsPreviewOpen(true)}
              disabled={isUploadingLogo}
            >
              <View style={{
                width: 50, height: 50, borderRadius: 12, backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {isUploadingLogo ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : logoUri ? (
                  <Image
                    source={{ uri: logoUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: 'PlusJakartaSans-Medium' }}>Logo</Text>
                )}
              </View>
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {t('dashboard.greeting', { name: user.name.split(' ')[0] })}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{roleSubtitle}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[
              { label: t('dashboard.stats.projects'), value: filteredProjects.length },
              { label: t('dashboard.stats.documents'), value: totalDocs },
              { label: t('dashboard.stats.photos'), value: totalPhotos },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{stat.value}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Section label with Org Filter for Superadmin */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textMuted }}>
              {t('dashboard.yourProjects')}
            </Text>
            {user.role === 'superadmin' && organizations.length > 0 && (
              <TouchableOpacity
                onPress={() => setIsOrgDropdownOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                  {selectedOrgId ? organizations.find(o => o.id === selectedOrgId)?.name : 'All Organizations'}
                </Text>
                <Feather name="chevron-down" size={12} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Project Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {filteredProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/project/${project.id}`)}
                style={{ width: '22%', alignItems: 'center', gap: 4 }}
              >
                {/* Thumbnail */}
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: project.color || '#f97316',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                    {project.name ? project.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                {/* Name */}
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: colors.text,
                    textAlign: 'center',
                    lineHeight: 13,
                  }}
                >
                  {project.name.split(' ').slice(0, 2).join(' ')}
                </Text>
                {/* Stats */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Feather name="file-text" size={9} color={colors.textMuted} />
                    <Text style={{ fontSize: 9, color: colors.textMuted }}>{parseInt(project.totalDocs, 10) || 0}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Feather name="camera" size={9} color={colors.textMuted} />
                    <Text style={{ fontSize: 9, color: colors.textMuted }}>{parseInt(project.totalPhotos, 10) || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Create Project card — admin only */}
            {user.role === 'admin' && (
              <TouchableOpacity
                onPress={() => setIsCreating(true)}
                style={{ width: '22%', alignItems: 'center', gap: 4 }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: '#f97316',
                  }}
                >
                  <Feather name="plus" size={24} color="#f97316" />
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '500',
                    color: '#f97316',
                    textAlign: 'center',
                    lineHeight: 13,
                  }}
                >
                  Create Project
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredProjects.length === 0 && (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {searchQuery ? 'No projects match your search.' : t('dashboard.noProjects')}
              </Text>
            </View>
          )}
        </ScrollView>
        {/* Create Project Modal */}
        <Modal visible={isCreating} animationType="fade" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
              onPress={() => setIsCreating(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}
                onPress={(e) => e.stopPropagation()}
              >
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>Create New Project</Text>

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Project Name</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="E.g. Alpha Tower"
                    placeholderTextColor={colors.textMuted}
                    value={newProject.name}
                    onChangeText={(text) => setNewProject({ ...newProject, name: text })}
                  />

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Description</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Short description"
                    placeholderTextColor={colors.textMuted}
                    value={newProject.description}
                    onChangeText={(text) => setNewProject({ ...newProject, description: text })}
                  />

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Start Date (YYYY-MM-DD)</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.background, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={{ color: newProject.start_date ? colors.text : colors.textMuted }}>
                      {newProject.start_date || 'Select Start Date'}
                    </Text>
                  </TouchableOpacity>

                  {showStartPicker && (
                    <DateTimePicker
                      value={newProject.start_date ? new Date(newProject.start_date) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowStartPicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setNewProject({ ...newProject, start_date: selectedDate.toISOString().split('T')[0] });
                        }
                      }}
                    />
                  )}

                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>End Date (YYYY-MM-DD)</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.background, padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={{ color: newProject.end_date ? colors.text : colors.textMuted }}>
                      {newProject.end_date || 'Select End Date'}
                    </Text>
                  </TouchableOpacity>

                  {showEndPicker && (
                    <DateTimePicker
                      value={newProject.end_date ? new Date(newProject.end_date) : new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowEndPicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setNewProject({ ...newProject, end_date: selectedDate.toISOString().split('T')[0] });
                        }
                      }}
                    />
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                    <TouchableOpacity onPress={() => setIsCreating(false)} style={{ padding: 12 }}>
                      <Text style={{ color: colors.textMuted, fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCreate}
                      disabled={isSubmitting}
                      style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' }}
                    >
                      {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>

        {/* Action Modals */}
        <HelpSupportModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
        <LanguageSelectorModal visible={showLanguage} onClose={() => setShowLanguage(false)} />

      </SafeAreaView>

      <LogoPreviewModal
        visible={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        logoUri={logoUri}
        canChange={user.role === 'admin'}
        onChangePress={() => {
          setIsPreviewOpen(false);
          handleLogoUpload();
        }}
      />

      {/* Org Selection Modal for Superadmin */}
      <Modal visible={isOrgDropdownOpen} animationType="fade" transparent>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsOrgDropdownOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, width: '100%', maxWidth: 400, padding: 10, overflow: 'hidden' }}>
            <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>Select Organization</Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity
                onPress={() => { setSelectedOrgId(null); setIsOrgDropdownOpen(false); }}
                style={{ padding: 15, backgroundColor: selectedOrgId === null ? colors.background : 'transparent' }}
              >
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: selectedOrgId === null ? 'bold' : 'normal' }}>All Organizations</Text>
              </TouchableOpacity>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  onPress={() => { setSelectedOrgId(org.id); setIsOrgDropdownOpen(false); }}
                  style={{ padding: 15, backgroundColor: selectedOrgId === org.id ? colors.background : 'transparent' }}
                >
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: selectedOrgId === org.id ? 'bold' : 'normal' }}>{org.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
