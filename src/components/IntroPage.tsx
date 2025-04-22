import React, { useState } from 'react';
import { saveProperty } from '../services/RestCalls';
import { getVision } from '../utils/api';
import fs from 'fs';

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
    const [images, setImages] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newImages = Array.from(e.target.files);
            setImages(prev => [...prev, ...newImages]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const convertImagesToText = async (images: File[]): Promise<string> => {
        const imageDescriptions: string[] = [];

        for (const image of images) {
            try {
                // // Compress image before converting to base64
                // const compressedImage = await new Promise<Blob>((resolve, reject) => {
                //     const reader = new FileReader();
                //     reader.onload = (e) => {
                //         const img = new Image();
                //         img.onload = () => {
                //             const canvas = document.createElement('canvas');
                //             const MAX_WIDTH = 800;
                //             const MAX_HEIGHT = 800;
                //             let width = img.width;
                //             let height = img.height;

                //             if (width > height) {
                //                 if (width > MAX_WIDTH) {
                //                     height *= MAX_WIDTH / width;
                //                     width = MAX_WIDTH;
                //                 }
                //             } else {
                //                 if (height > MAX_HEIGHT) {
                //                     width *= MAX_HEIGHT / height;
                //                     height = MAX_HEIGHT;
                //                 }
                //             }

                //             canvas.width = width;
                //             canvas.height = height;
                //             const ctx = canvas.getContext('2d');
                //             if (!ctx) {
                //                 reject(new Error('Could not get canvas context'));
                //                 return;
                //             }
                //             ctx.drawImage(img, 0, 0, width, height);
                //             canvas.toBlob((blob) => {
                //                 if (blob) {
                //                     resolve(blob);
                //                 } else {
                //                     reject(new Error('Failed to create blob'));
                //                 }
                //             }, 'image/jpeg', 0.7);
                //         };
                //         img.onerror = reject;
                //         img.src = e.target?.result as string;
                //     };
                //     reader.onerror = reject;
                //     reader.readAsDataURL(image);
                // });

                // // Convert compressed image to base64
                // const base64Image = await new Promise<string>((resolve, reject) => {
                //     const reader = new FileReader();
                //     reader.onload = () => resolve(reader.result as string);
                //     reader.onerror = reject;
                //     reader.readAsDataURL(compressedImage);
                // });

                // Create the image data object

                const reader = new FileReader();
                const base64Image = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(image);
                });

                const imageData = {
                    image_url: base64Image.split(',')[1], // Remove the data URL prefix
                    prompt: "Describe this image in detail"
                };

                // Call the vision API
                const description = await getVision(imageData);
                imageDescriptions.push(description);
            } catch (error) {
                console.error('Error processing image:', error);
                // Continue with other images even if one fails
            }
        }

        // Combine all image descriptions
        return imageDescriptions.join('\n\n');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Convert images to text and append to description
            const imageText = await convertImagesToText(images);
            const updatedDescription = propertyInfo.description + (imageText ? '\n\n Intrarea este: ' + imageText : '');

            const updatedPropertyInfo = {
                ...propertyInfo,
                description: updatedDescription
            };

            await saveProperty(updatedPropertyInfo);
            onPropertySubmit(updatedPropertyInfo);
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

                    <div>
                        <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-1">
                            Property Images
                        </label>
                        <input
                            type="file"
                            id="images"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isSubmitting}
                        />
                        {images.length > 0 && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                {images.map((image, index) => (
                                    <div key={index} className="relative">
                                        <img
                                            src={URL.createObjectURL(image)}
                                            alt={`Property image ${index + 1}`}
                                            className="w-full h-24 object-cover rounded-md"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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