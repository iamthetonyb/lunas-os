'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from './ConfirmationDialog';
import { CommunityDetail } from './community-detail';

type Builder = { _id: Id<"builders">; name: string };
type Community = { _id: Id<"communities">; name: string; builderId?: Id<"builders"> | null };

export function BuildersCrud() {
    const { t } = useTranslation();
    const builders = useQuery(api.queries.getBuilders, {}) ?? [];
    const communities = useQuery(api.queries.getCommunities, {}) ?? [];
    const loadingBuilders = builders === undefined;
    const loadingCommunities = communities === undefined;

    const createBuilder = useMutation(api.mutations.createBuilder);
    const updateBuilder = useMutation(api.mutations.updateBuilder);
    const deleteBuilder = useMutation(api.mutations.deleteBuilder);
    const createCommunity = useMutation(api.mutations.createCommunity);
    const updateCommunity = useMutation(api.mutations.updateCommunity);
    const deleteCommunity = useMutation(api.mutations.deleteCommunity);

    const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
    const [newBuilderName, setNewBuilderName] = useState('');
    const [newCommunityName, setNewCommunityName] = useState('');
    const [isAddingBuilder, setIsAddingBuilder] = useState(false);
    const [isAddingCommunity, setIsAddingCommunity] = useState(false);
    const [editingBuilderId, setEditingBuilderId] = useState<string | null>(null);
    const [editingBuilderName, setEditingBuilderName] = useState('');
    const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
    const [editingCommunityName, setEditingCommunityName] = useState('');
    const [editingCommunityBuilderId, setEditingCommunityBuilderId] = useState<string>('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; type: 'builder' | 'community' } | null>(null);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

    const filteredCommunities = selectedBuilderId
        ? communities.filter(c => c.builderId === selectedBuilderId)
        : communities;

    const handleAddBuilder = async () => {
        if (!newBuilderName.trim()) return;
        setIsAddingBuilder(true);
        try {
            await createBuilder({ name: newBuilderName.trim() });
            setNewBuilderName('');
            toast.success(`Builder "${newBuilderName}" added!`);
        } catch (error) {
            toast.error('Failed to add builder');
        } finally {
            setIsAddingBuilder(false);
        }
    };

    const handleUpdateBuilder = async (id: string) => {
        if (!editingBuilderName.trim()) return;
        try {
            await updateBuilder({ id: id as Id<"builders">, name: editingBuilderName.trim() });
            setEditingBuilderId(null);
            toast.success('Builder updated!');
        } catch (error) {
            toast.error('Failed to update builder');
        }
    };

    const handleDeleteBuilder = async (id: string, name: string) => {
        try {
            await deleteBuilder({ id: id as Id<"builders"> });
            if (selectedBuilderId === id) setSelectedBuilderId(null);
            toast.success(`Builder "${name}" deleted!`);
        } catch (error) {
            toast.error('Failed to delete builder. It may have associated data.');
        }
    };

    const handleAddCommunity = async () => {
        if (!newCommunityName.trim()) return;
        setIsAddingCommunity(true);
        try {
            await createCommunity({
                name: newCommunityName.trim(),
                builderId: selectedBuilderId ? selectedBuilderId as Id<"builders"> : undefined,
            });
            setNewCommunityName('');
            toast.success(`Community "${newCommunityName}" added!`);
        } catch (error) {
            toast.error('Failed to add community');
        } finally {
            setIsAddingCommunity(false);
        }
    };

    const handleUpdateCommunity = async (id: string) => {
        if (!editingCommunityName.trim()) return;
        try {
            const updates: { id: Id<"communities">; name?: string; builderId?: Id<"builders"> } = {
                id: id as Id<"communities">,
                name: editingCommunityName.trim(),
            };
            if (editingCommunityBuilderId) {
                updates.builderId = editingCommunityBuilderId as Id<"builders">;
            }
            await updateCommunity(updates);
            setEditingCommunityId(null);
            toast.success('Community updated!');
        } catch (error) {
            toast.error('Failed to update community');
        }
    };

    const handleDeleteCommunity = async (id: string, name: string) => {
        try {
            await deleteCommunity({ id: id as Id<"communities"> });
            toast.success(`Community "${name}" deleted!`);
        } catch (error) {
            toast.error('Failed to delete community. It may have associated jobs.');
        }
    };

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Builders Panel */}
            <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">🏗️ Builders</h4>
                    <span className="text-sm text-gray-500">{builders.length} total</span>
                </div>

                {/* Add Builder Form */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newBuilderName}
                        onChange={(e) => setNewBuilderName(e.target.value)}
                        placeholder="New builder name..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddBuilder()}
                    />
                    <button
                        onClick={handleAddBuilder}
                        disabled={isAddingBuilder || !newBuilderName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isAddingBuilder ? '...' : '+ Add'}
                    </button>
                </div>

                {/* Builders List */}
                {loadingBuilders ? (
                    <p className="text-gray-500 text-sm">{t('common.loading')}</p>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {builders.map((builder) => (
                            <div
                                key={builder._id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${selectedBuilderId === builder._id
                                    ? 'bg-blue-100 dark:bg-blue-900'
                                    : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {editingBuilderId === builder._id ? (
                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={editingBuilderName}
                                            onChange={(e) => setEditingBuilderName(e.target.value)}
                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateBuilder(builder._id)}
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdateBuilder(builder._id)} className="text-green-600 text-xs">{t('common.save')}</button>
                                        <button onClick={() => setEditingBuilderId(null)} className="text-gray-500 text-xs">{t('common.cancel')}</button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setSelectedBuilderId(builder._id === selectedBuilderId ? null : builder._id)}
                                            className="text-left flex-1 text-gray-700 dark:text-gray-300"
                                        >
                                            {builder.name}
                                        </button>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setEditingBuilderId(builder._id); setEditingBuilderName(builder.name); }}
                                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                {t('common.edit')}
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm({ id: builder._id, name: builder.name, type: 'builder' })}
                                                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                            >
                                                {t('common.delete')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Communities Panel */}
            <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        🏘️ Communities
                        {selectedBuilderId && (
                            <span className="text-sm font-normal text-blue-600 ml-2">
                                (for {builders.find(b => b._id === selectedBuilderId)?.name})
                            </span>
                        )}
                    </h4>
                    <span className="text-sm text-gray-500">{filteredCommunities.length} shown</span>
                </div>

                {/* Add Community Form */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newCommunityName}
                        onChange={(e) => setNewCommunityName(e.target.value)}
                        placeholder="New community name..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCommunity()}
                    />
                    <button
                        onClick={handleAddCommunity}
                        disabled={isAddingCommunity || !newCommunityName.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                        {isAddingCommunity ? '...' : '+ Add'}
                    </button>
                </div>

                {/* Communities List */}
                {loadingCommunities ? (
                    <p className="text-gray-500 text-sm">{t('common.loading')}</p>
                ) : filteredCommunities.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        {selectedBuilderId ? 'No communities for this builder' : 'Select a builder to filter'}
                    </p>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {filteredCommunities.map((community) => (
                            <div key={community._id}>
                                <div
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                                        selectedCommunityId === community._id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                            : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                    }`}
                                    onClick={() => setSelectedCommunityId(selectedCommunityId === community._id ? null : community._id)}
                                >
                                    {editingCommunityId === community._id ? (
                                        <div className="flex gap-2 flex-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editingCommunityName}
                                                onChange={(e) => setEditingCommunityName(e.target.value)}
                                                className="flex-1 min-w-[120px] px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white"
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateCommunity(community._id)}
                                                autoFocus
                                            />
                                            <select
                                                value={editingCommunityBuilderId}
                                                onChange={(e) => setEditingCommunityBuilderId(e.target.value)}
                                                className="px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white min-w-[100px]"
                                            >
                                                <option value="">{t('common.builder')}...</option>
                                                {builders.map(b => (
                                                    <option key={b._id} value={b._id}>{b.name}</option>
                                                ))}
                                            </select>
                                            <button onClick={() => handleUpdateCommunity(community._id)} className="text-green-600 text-xs">{t('common.save')}</button>
                                            <button onClick={() => setEditingCommunityId(null)} className="text-gray-500 text-xs">{t('common.cancel')}</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-gray-700 dark:text-gray-300 flex-1">{community.name}</span>
                                            {!selectedBuilderId && community.builderId && (
                                                <span className="text-xs text-gray-500 mr-2">
                                                    {builders.find(b => b._id === community.builderId)?.name}
                                                </span>
                                            )}
                                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => { setEditingCommunityId(community._id); setEditingCommunityName(community.name); setEditingCommunityBuilderId(community.builderId ?? ''); }}
                                                    className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                >
                                                    {t('common.edit')}
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ id: community._id, name: community.name, type: 'community' })}
                                                    className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    {t('common.delete')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {selectedCommunityId === community._id && (
                                    <div className="mt-2 ml-2">
                                        <CommunityDetail
                                            communityId={community._id}
                                            communityName={community.name}
                                            builderId={community.builderId}
                                            onClose={() => setSelectedCommunityId(null)}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <ConfirmationDialog
            isOpen={!!deleteConfirm}
            onClose={() => setDeleteConfirm(null)}
            onConfirm={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === 'builder') {
                    handleDeleteBuilder(deleteConfirm.id, deleteConfirm.name);
                } else {
                    handleDeleteCommunity(deleteConfirm.id, deleteConfirm.name);
                }
                setDeleteConfirm(null);
            }}
            title={`Delete ${deleteConfirm?.type === 'builder' ? 'Builder' : 'Community'}`}
            message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            variant="danger"
        />
        </>
    );
}
