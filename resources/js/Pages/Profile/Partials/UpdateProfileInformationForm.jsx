import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Transition } from '@headlessui/react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { IMAGE_UPLOAD_ACCEPT, prepareImageUpload } from '@/Utils/imageUpload';

export default function UpdateProfileInformation({ mustVerifyEmail, status, className = '' }) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful, reset } = useForm({
        name: user.name,
        email: user.email,
        avatar: null,
    });

    const [preview, setPreview] = useState(user.avatar || null);
    const [avatarError, setAvatarError] = useState('');

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.update'), {
            onSuccess: () => {
                reset('avatar');
            },
            preserveScroll: true,
        });
    };

    useEffect(() => {
        return () => {
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>

                <p className="mt-1 text-sm text-gray-600">
                    Update your account's profile information and email address.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div>
                    <InputLabel htmlFor="name" value="Name" />

                    <TextInput
                        id="name"
                        className="mt-1 block w-full"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-2" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="Email" />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                <div>
                    <InputLabel htmlFor="avatar" value="Avatar" />

                    <div className="flex items-center gap-4 mt-2">
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {preview ? (
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg font-semibold text-gray-600">
                                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            )}
                        </div>
                        <input
                            id="avatar"
                            type="file"
                            accept={IMAGE_UPLOAD_ACCEPT}
                            onChange={async (e) => {
                                const file = e.target.files[0];

                                if (!file) {
                                    setData('avatar', null);
                                    setAvatarError('');
                                    return;
                                }

                                const result = await prepareImageUpload(file, {
                                    maxWidth: 1200,
                                    maxHeight: 1200,
                                });

                                if (!result.ok) {
                                    setData('avatar', null);
                                    setAvatarError(result.error);
                                    toast.error(result.error);
                                    return;
                                }

                                setAvatarError('');
                                setData('avatar', result.file);
                                setPreview(URL.createObjectURL(result.file));
                            }}
                        />
                    </div>
                    <InputError className="mt-2" message={avatarError || errors.avatar} />
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div>
                        <p className="text-sm mt-2 text-gray-800">
                            Your email address is unverified.
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="underline text-sm text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Click here to re-send the verification email.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 font-medium text-sm text-green-600">
                                A new verification link has been sent to your email address.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600">Saved.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
