"use server"

import { auth } from "@/lib/auth";


export const signInUser = async (email: string, password: string) => {
    try { 
    await auth.api.signInEmail({
        body: {
            email,
            password,
        },
        asResponse: true,
    
    });

    return({success: true,message: "Sign In Successful"})
} catch(err) {
    const e = err as Error;
    return({success: false, message: e.message || 'Something went wrong'})
}};

export const signUpUser = async (email: string, password: string, name: string) => {
    try { 
        await auth.api.signUpEmail({
        body: {
            email,
            password,
            name,
        }
    });
    return({success: true,message: "Sign Up Successful"})
} catch(err) {
    return({success: false, message: err || 'Something went wrong'})
}
}