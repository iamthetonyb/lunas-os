'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';

type Builder = { id: string; name: string };
type Community = { id: string; name: string; builderId?: string | null };

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

export function BuildersCrud() {
    const { data: builders = [], isLoading: loadingBuilders } = useSWR<Builder[]>('/api/builders', fetcher);
    const { data: communities = [], isLoading: loadingCommunities } = useSWR<Community[]>('/api/communities', fetcher);

    const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
    const [newBuilderName, setNewBuilderName] = useState('');
    const [newCommunityName, setNewCommunityName] = useState('');
    const [isAddingBuilder, setIsAddingBuilder] = useState(false);
    const [isAddingCommunity, setIsAddingCommunity] = useState(false);
    const [editingBuilderId, setEditingBuilderId] = useState<string | null>(null);
    const [editingBuilderName, setEditingBuilderName] = useState('');
    const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
    const [editingCommunityName, setEditingCommunityName] = useState('');

    const filteredCommunities = selectedBuilderId
        ? communities.filter(c => c.builderId === selectedBuilderId)
        : communities;

    const handleAddBuilder = async () => {
        if (!newBuilderName.trim()) return;
        setIsAddingBuilder(true);
        try {
            await fetchJSON('/api/builders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newBuilderName.trim() }),
            });
            setNewBuilderName('');
            mutate('/api/builders');
        } catch (error) {
            alert('Failed to add builder');
        } finally {
            setIsAddingBuilder(false);
        }
    };

    const handleUpdateBuilder = async (id: string) => {
        if (!editingBuilderName.trim()) return;
        try {
            await fetchJSON(`/api/builders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editingBuilderName.trim() }),
            });
            setEditingBuilderId(null);
            mutate('/api/builders');
        } catch (error) {
            alert('Failed to update builder');
        }
    };

    const handleDeleteBuilder = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
        try {
            await fetchJSON(`/api/builders/${id}`, { method: 'DELETE' });
            mutate('/api/builders');
            if (selectedBuilderId === id) setSelectedBuilderId(null);
        } catch (error) {
            alert('Failed to delete builder. It may have associated data.');
        }
    };

    const handleAddCommunity = async () => {
        if (!newCommunityName.trim()) return;
        setIsAddingCommunity(true);
        try {
            await fetchJSON('/api/communities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCommunityName.trim(),
                    builderId: selectedBuilderId,
                }),
            });
            setNewCommunityName('');
            mutate('/api/communities');
        } catch (error) {
            alert('Failed to add community');
        } finally {
            setIsAddingCommunity(false);
        }
    };

    const handleUpdateCommunity = async (id: string) => {
        if (!editingCommunityName.trim()) return;
        try {
            await fetchJSON(`/api/communities/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editingCommunityName.trim() }),
            });
            setEditingCommunityId(null);
            mutate('/api/communities');
        } catch (error) {
            alert('Failed to update community');
        }
    };

    const handleDeleteCommunity = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
        try {
            await fetchJSON(`/api/communities/${id}`, { method: 'DELETE' });
            mutate('/api/communities');
        } catch (error) {
            alert('Failed to delete community. It may have associated jobs.');
        }
    };

    return (
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
                    <p className="text-gray-500 text-sm">Loading...</p>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {builders.map((builder) => (
                            <div
                                key={builder.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${selectedBuilderId === builder.id
                                        ? 'bg-blue-100 dark:bg-blue-900'
                                        : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {editingBuilderId === builder.id ? (
                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={editingBuilderName}
                                            onChange={(e) => setEditingBuilderName(e.target.value)}
                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateBuilder(builder.id)}
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdateBuilder(builder.id)} className="text-green-600 text-xs">Save</button>
                                        <button onClick={() => setEditingBuilderId(null)} className="text-gray-500 text-xs">Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setSelectedBuilderId(builder.id === selectedBuilderId ? null : builder.id)}
                                            className="text-left flex-1 text-gray-700 dark:text-gray-300"
                                        >
                                            {builder.name}
                                        </button>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setEditingBuilderId(builder.id); setEditingBuilderName(builder.name); }}
                                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBuilder(builder.id, builder.name)}
                                                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                            >
                                                Delete
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
                                (for {builders.find(b => b.id === selectedBuilderId)?.name})
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
                    <p className="text-gray-500 text-sm">Loading...</p>
                ) : filteredCommunities.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        {selectedBuilderId ? 'No communities for this builder' : 'Select a builder to filter'}
                    </p>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {filteredCommunities.map((community) => (
                            <div
                                key={community.id}
                                className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm"
                            >
                                {editingCommunityId === community.id ? (
                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={editingCommunityName}
                                            onChange={(e) => setEditingCommunityName(e.target.value)}
                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateCommunity(community.id)}
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdateCommunity(community.id)} className="text-green-600 text-xs">Save</button>
                                        <button onClick={() => setEditingCommunityId(null)} className="text-gray-500 text-xs">Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-gray-700 dark:text-gray-300 flex-1">{community.name}</span>
                                        {!selectedBuilderId && community.builderId && (
                                            <span className="text-xs text-gray-500 mr-2">
                                                {builders.find(b => b.id === community.builderId)?.name}
                                            </span>
                                        )}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setEditingCommunityId(community.id); setEditingCommunityName(community.name); }}
                                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCommunity(community.id, community.name)}
                                                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
