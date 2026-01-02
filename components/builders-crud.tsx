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
                            <button
                                key={builder.id}
                                onClick={() => setSelectedBuilderId(builder.id === selectedBuilderId ? null : builder.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedBuilderId === builder.id
                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium'
                                        : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                {builder.name}
                            </button>
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
                                <span className="text-gray-700 dark:text-gray-300">{community.name}</span>
                                {!selectedBuilderId && community.builderId && (
                                    <span className="text-xs text-gray-500">
                                        {builders.find(b => b.id === community.builderId)?.name}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
