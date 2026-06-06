<?php

namespace App\Http\Requests;

use Spatie\Permission\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array|string>
     */
    public function rules(): array
    {
        $userId = $this->route('user')?->id ?? null;
        $isCreate = $this->isMethod('post');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => [$isCreate ? 'required' : 'nullable', 'string', 'min:8', 'confirmed'],
            'avatar' => ['nullable', 'image', 'max:2048'],
            'selectedRoles' => ['required', 'array', 'min:1'],
            'selectedRoles.*' => ['string'],
            'selectedOutlets' => ['nullable', 'array'],
            'selectedOutlets.*' => ['integer', 'exists:outlets,id'],
            'primary_outlet_id' => ['nullable', 'integer', 'exists:outlets,id'],
            'preferred_workspace' => ['nullable', Rule::in(['standard', 'kitchen'])],
            'preferred_kitchen_station_id' => ['nullable', 'integer', 'exists:kitchen_stations,id'],
            'waiter_service_scope' => ['nullable', Rule::in(['outlet_all', 'tenant_only'])],
            'waiter_tenant_outlet_ids' => ['nullable', 'array'],
            'waiter_tenant_outlet_ids.*' => ['integer', 'exists:outlets,id'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $selectedRoleNames = collect($this->input('selectedRoles', []))
                ->filter()
                ->values();

            if ($selectedRoleNames->isEmpty()) {
                return;
            }

            $selectedRoles = Role::query()
                ->with('permissions:id,name')
                ->whereIn('name', $selectedRoleNames->all())
                ->get();

            $hasDeliveryAccess = $selectedRoles
                ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
                ->contains('waiter-board-access');

            if (! $hasDeliveryAccess) {
                return;
            }

            if ($this->input('waiter_service_scope', 'outlet_all') !== 'tenant_only') {
                return;
            }

            $tenantOutletIds = collect($this->input('waiter_tenant_outlet_ids', []))
                ->filter()
                ->values();

            if ($tenantOutletIds->isEmpty()) {
                $validator->errors()->add(
                    'waiter_tenant_outlet_ids',
                    'Pilih minimal satu tenant/dapur untuk waiter dengan cakupan per dapur.'
                );
            }
        });
    }
}
