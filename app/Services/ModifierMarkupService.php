<?php

namespace App\Services;

use App\Models\ProductModifierOption;
use App\Models\Setting;
use Illuminate\Support\Collection;

class ModifierMarkupService
{
    private const SETTING_KEY = 'modifier_markup_rules';

    public function settingsPayload(?int $outletId = null): array
    {
        return [
            'rules' => $this->getRules($outletId)->all(),
        ];
    }

    public function getRules(?int $outletId = null): Collection
    {
        $raw = Setting::get(self::SETTING_KEY, '[]', $outletId);
        $decoded = is_string($raw) ? json_decode($raw, true) : $raw;

        if (! is_array($decoded)) {
            return collect();
        }

        return collect($decoded)
            ->map(function ($rule, $index) {
                $operator = (string) data_get($rule, 'operator', 'lt');
                $markupType = (string) data_get($rule, 'markup_type', 'fixed_amount');
                $compareValue = max(0, (int) data_get($rule, 'compare_value', 0));
                $compareValueTo = data_get($rule, 'compare_value_to');

                return [
                    'id' => (string) data_get($rule, 'id', 'rule-'.$index),
                    'label' => trim((string) data_get($rule, 'label', '')),
                    'operator' => in_array($operator, ['lt', 'lte', 'eq', 'gte', 'gt', 'between'], true)
                        ? $operator
                        : 'lt',
                    'compare_value' => $compareValue,
                    'compare_value_to' => filled($compareValueTo) ? max(0, (int) $compareValueTo) : null,
                    'markup_type' => in_array($markupType, ['fixed_amount', 'percentage'], true)
                        ? $markupType
                        : 'fixed_amount',
                    'markup_value' => max(0, (int) data_get($rule, 'markup_value', 0)),
                    'is_active' => (bool) data_get($rule, 'is_active', true),
                    'sort_order' => (int) data_get($rule, 'sort_order', $index),
                ];
            })
            ->filter(fn (array $rule) => $rule['is_active'])
            ->sortBy([
                ['sort_order', 'asc'],
                ['id', 'asc'],
            ])
            ->values();
    }

    public function resolveForBasePrice(int $basePrice, ?int $outletId = null): array
    {
        $resolvedBasePrice = max(0, $basePrice);
        $matchedRule = $this->getRules($outletId)
            ->first(fn (array $rule) => $this->matchesRule($resolvedBasePrice, $rule));

        $markupPrice = $matchedRule
            ? $this->resolveMarkupAmount($resolvedBasePrice, $matchedRule)
            : 0;

        return [
            'base_price' => $resolvedBasePrice,
            'markup_price' => $markupPrice,
            'effective_price' => $resolvedBasePrice + $markupPrice,
            'rule' => $matchedRule ? [
                'id' => $matchedRule['id'],
                'label' => $matchedRule['label'],
                'operator' => $matchedRule['operator'],
                'compare_value' => $matchedRule['compare_value'],
                'compare_value_to' => $matchedRule['compare_value_to'],
                'markup_type' => $matchedRule['markup_type'],
                'markup_value' => $matchedRule['markup_value'],
            ] : null,
        ];
    }

    public function payloadForOption(ProductModifierOption $option, ?int $outletId = null): array
    {
        $pricing = $this->resolveForBasePrice((int) ($option->price ?? 0), $outletId);

        return [
            'id' => $option->id,
            'group_name' => $option->group_name,
            'selection_mode' => $option->selection_mode ?: 'optional',
            'min_select' => (int) ($option->min_select ?? 0),
            'max_select' => $option->max_select !== null ? (int) $option->max_select : null,
            'name' => $option->name,
            'price' => (int) $pricing['effective_price'],
            'base_price' => (int) $pricing['base_price'],
            'markup_price' => (int) $pricing['markup_price'],
            'effective_price' => (int) $pricing['effective_price'],
            'markup_rule' => $pricing['rule'],
            'stock' => $option->stock !== null ? (int) $option->stock : null,
            'is_required' => (bool) $option->is_required,
        ];
    }

    private function matchesRule(int $basePrice, array $rule): bool
    {
        return match ($rule['operator']) {
            'lt' => $basePrice < $rule['compare_value'],
            'lte' => $basePrice <= $rule['compare_value'],
            'eq' => $basePrice === $rule['compare_value'],
            'gte' => $basePrice >= $rule['compare_value'],
            'gt' => $basePrice > $rule['compare_value'],
            'between' => $rule['compare_value_to'] !== null
                && $basePrice >= min($rule['compare_value'], $rule['compare_value_to'])
                && $basePrice <= max($rule['compare_value'], $rule['compare_value_to']),
            default => false,
        };
    }

    private function resolveMarkupAmount(int $basePrice, array $rule): int
    {
        if ($rule['markup_type'] === 'percentage') {
            return max(0, (int) round($basePrice * ($rule['markup_value'] / 100)));
        }

        return max(0, (int) $rule['markup_value']);
    }
}
