import React, { useState } from 'react';
import { saveProperty } from '../services/RestCalls';

export interface PropertyInfo {
    name: string;
    address: string;
    description: string;
}

interface IntroPageProps {
    onPropertySubmit: (propertyInfo: PropertyInfo) => void;
}

const IntroPage: React.FC<IntroPageProps> = ({ onPropertySubmit }) => {
    const [propertyInfo, setPropertyInfo] = useState<PropertyInfo>({
        name: '',
        address: '',
        description: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            await saveProperty(propertyInfo);
            onPropertySubmit(propertyInfo);
        } catch (err) {
            console.error('Error saving property:', err);
            setError('Failed to save property information. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to Sonic Assistant</h1>
                    <p className="text-gray-600">Please provide some information about your property to get started</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Property Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={propertyInfo.name}
                            onChange={(e) => setPropertyInfo({ ...propertyInfo, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter property name"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                            Property Address
                        </label>
                        <input
                            type="text"
                            id="address"
                            value={propertyInfo.address}
                            onChange={(e) => setPropertyInfo({ ...propertyInfo, address: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter property address"
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            Property Description
                        </label>
                        <textarea
                            id="description"
                            value={propertyInfo.description}
                            onChange={(e) => setPropertyInfo({ ...propertyInfo, description: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Describe your property"
                            rows={4}
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : 'Start Voice Assistant'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default IntroPage; 