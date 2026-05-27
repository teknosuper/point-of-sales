import React, { useState } from 'react'
import { Listbox } from '@headlessui/react'
import {
    IconChevronDown,
    IconCircle,
    IconCircleFilled,
    IconFilterOff,
    IconSearch,
    IconSelector,
    IconX,
} from '@/Utils/icons'
import { decoratePermission } from "@/Utils/permissionPresentation";
export default function ListBox({ selected, data, setSelected, label, errors, presets = [] }) {
    const [search, setSearch] = useState('');
    const [activeGroup, setActiveGroup] = useState('');

    const preview = selected.length ?
        selected.length >= 4 ? `jumlah hak akses terpilih ${selected.length}` :
            selected.map((item) => decoratePermission(item).label).join(', ')
        :
        'Pilih Hak Akses'

    const decoratedItems = data.map((item) => decoratePermission(item));
    const groupCounts = decoratedItems.reduce((accumulator, item) => {
        accumulator[item.group] = accumulator[item.group] || {
            key: item.group,
            label: item.group_label,
            count: 0,
        };
        accumulator[item.group].count += 1;
        return accumulator;
    }, {});
    const groups = Object.values(groupCounts).sort((left, right) =>
        left.label.localeCompare(right.label, 'id-ID')
    );
    const filteredItems = decoratedItems.filter((item) => {
        const matchesSearch =
            search.trim() === '' ||
            item.label.toLowerCase().includes(search.toLowerCase()) ||
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.group_label.toLowerCase().includes(search.toLowerCase());
        const matchesGroup = activeGroup === '' || item.group === activeGroup;

        return matchesSearch && matchesGroup;
    });
    const groupedFilteredItems = filteredItems.reduce((accumulator, item) => {
        accumulator[item.group] = accumulator[item.group] || {
            key: item.group,
            label: item.group_label,
            items: [],
        };
        accumulator[item.group].items.push(item);
        return accumulator;
    }, {});
    const groupedSections = Object.values(groupedFilteredItems).sort((left, right) =>
        left.label.localeCompare(right.label, 'id-ID')
    );
    const selectedIds = new Set(selected.map((item) => item.id));
    const visibleIds = filteredItems.map((item) => item.id);
    const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    const handleSelectAllVisible = () => {
        if (allVisibleSelected) {
            setSelected(selected.filter((item) => !visibleIds.includes(item.id)));
            return;
        }

        const merged = [...selected];
        filteredItems.forEach((item) => {
            if (!selectedIds.has(item.id)) {
                merged.push(item);
            }
        });
        setSelected(merged);
    };

    const handleClearAll = () => setSelected([]);
    const applyPreset = (permissionNames = []) => {
        const presetItems = decoratedItems.filter((item) =>
            permissionNames.includes(item.name)
        );
        const merged = [...selected];
        const currentIds = new Set(selected.map((item) => item.id));

        presetItems.forEach((item) => {
            if (!currentIds.has(item.id)) {
                merged.push(item);
            }
        });

        setSelected(merged);
    };

    return (
        <div className='flex flex-col gap-2'>
            <label className='text-gray-600 text-sm'>{label}</label>
            <Listbox value={selected} onChange={setSelected} multiple by="id">
                <Listbox.Button className={'w-full px-3 py-1.5 border text-sm rounded-md focus:outline-none focus:ring-0 flex justify-between items-center gap-8 bg-white text-gray-700 focus:border-gray-200 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-700 dark:border-gray-800'}>
                    {preview}
                    <IconChevronDown size={20} strokeWidth={1.5} />
                </Listbox.Button>
                <Listbox.Options className={'max-h-[55vh] overflow-y-auto overscroll-contain rounded-lg border bg-gray-100 dark:border-gray-900 dark:bg-gray-950'}>
                    <div className='sticky top-0 z-10 space-y-3 border-b border-gray-200 bg-gray-100 p-4 dark:border-gray-900 dark:bg-gray-950'>
                        <div className='grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]'>
                            <div className='relative'>
                                <input
                                    type='text'
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder='Cari nama izin, nama teknis, atau group...'
                                    className='h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                                />
                                <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400'>
                                    <IconSearch size={16} />
                                </div>
                            </div>
                            <button
                                type='button'
                                onClick={handleSelectAllVisible}
                                className='inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                            >
                                <IconSelector size={14} />
                                {allVisibleSelected ? 'Batalkan Terlihat' : 'Pilih Terlihat'}
                            </button>
                            <button
                                type='button'
                                onClick={handleClearAll}
                                className='inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
                            >
                                <IconX size={14} />
                                Kosongkan
                            </button>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <button
                                type='button'
                                onClick={() => setActiveGroup('')}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                    activeGroup === ''
                                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                                }`}
                            >
                                Semua Group
                            </button>
                            {groups.map((group) => (
                                <button
                                    key={group.key}
                                    type='button'
                                    onClick={() => setActiveGroup(group.key)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                        activeGroup === group.key
                                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                                    }`}
                                >
                                    {group.label}: {group.count}
                                </button>
                            ))}
                            {(search || activeGroup) && (
                                <button
                                    type='button'
                                    onClick={() => {
                                        setSearch('');
                                        setActiveGroup('');
                                    }}
                                    className='inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 hover:border-primary-300 hover:text-primary-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
                                >
                                    <IconFilterOff size={12} />
                                    Reset
                                </button>
                            )}
                        </div>
                        <div className='text-xs text-gray-500 dark:text-gray-400'>
                            Menampilkan {filteredItems.length} dari {decoratedItems.length} izin • terpilih {selected.length}
                        </div>
                        {presets.length > 0 && (
                            <div className='flex flex-wrap gap-2'>
                                {presets.map((preset) => (
                                    <button
                                        key={preset.key}
                                        type='button'
                                        onClick={() => applyPreset(preset.permissions)}
                                        className='rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300'
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className='space-y-4 p-4'>
                        {groupedSections.map((section) => (
                            <div key={section.key} className='space-y-2'>
                                <div className='flex items-center justify-between gap-3'>
                                    <p className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                                        {section.label}
                                    </p>
                                    <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400'>
                                        {section.items.length} izin
                                    </span>
                                </div>
                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                    {section.items.map((item) => {
                                        const decorated = item;

                                        return (
                                        <Listbox.Option key={item.id} value={item}>
                                            {({ selected }) => (
                                                <div
                                                    className='text-sm cursor-pointer px-3 py-1.5 rounded-lg flex items-start gap-2 bg-white text-gray-700 hover:bg-gray-200 border dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 '>
                                                    {selected ? <IconCircleFilled size={15} strokeWidth={1.5} className='text-teal-500' /> : <IconCircle size={15} strokeWidth={1.5} />}
                                                    <div className='flex flex-col'>
                                                        <span>{decorated.label}</span>
                                                        <span className='text-xs text-gray-400'>{decorated.name}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </Listbox.Option>
                                    )})}
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredItems.length === 0 && (
                        <div className='m-4 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400'>
                            Tidak ada hak akses yang cocok dengan filter saat ini.
                        </div>
                    )}
                </Listbox.Options>
            </Listbox>
            {errors && (
                <small className='text-xs text-red-500'>{errors}</small>
            )}
        </div>
    )
}
